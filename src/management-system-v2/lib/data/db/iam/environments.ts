import { v4 } from 'uuid';
import Ability, { UnauthorizedError } from '@/lib/ability/abilityHelper';
import { addRole, getRoleByName } from './roles';
import { adminPermissions } from '@/lib/authorization/permissionHelpers';
import { addRoleMappings } from './role-mappings';
import { addMember } from './memberships';
import {
  Environment,
  EnvironmentInput,
  UserOrganizationEnvironmentInput,
  UserOrganizationEnvironmentInputSchema,
  environmentSchema,
} from '../../environment-schema';
import { createFolder } from '../folders';
import { toCaslResource } from '@/lib/ability/caslAbility';
import { enableUseDB } from 'FeatureFlags';
import db from '@/lib/data/db';
import { Prisma } from '@prisma/client';
import { env } from '@/lib/ms-config/env-vars';

export async function getEnvironments() {
  //TODO : Ability check

  const environments = await db.space.findMany({});
  return environments;
}
export async function getEnvironmentById(
  id: string,
  ability?: Ability,
  opts?: { throwOnNotFound?: boolean },
  tx?: Prisma.TransactionClient,
) {
  const dbMutator = tx || db;

  // TODO: check ability
  let environment = await dbMutator.space.findUnique({
    where: {
      id: id,
    },
  });

  if (!env.PROCEED_PUBLIC_IAM_PERSONAL_SPACES_ACTIVE && !environment?.isOrganization)
    environment = null;

  if (!environment && opts && opts.throwOnNotFound) throw new Error('Environment not found');

  return environment as Environment;
}

/** Sets an environment to active, and adds the given user as an admin */
export async function activateEnvrionment(environmentId: string, userId: string) {
  const environment = await getEnvironmentById(environmentId);
  if (!environment) throw new Error("Environment doesn't exist");
  if (!environment.isOrganization) throw new Error('Environment is a personal environment');
  if (environment.isActive) throw new Error('Environment is already active');

  const adminRole = await getRoleByName(environmentId, '@admin');
  if (!adminRole) throw new Error(`Consistency error: admin role of ${environmentId} not found`);

  await addMember(environmentId, userId);

  await addRoleMappings([
    {
      environmentId,
      roleId: adminRole.id,
      userId,
    },
  ]);
}

export async function addEnvironment(
  environmentInput: EnvironmentInput,
  ability?: Ability,
  tx?: Prisma.TransactionClient,
): Promise<Environment> {
  // If `tx` is provided, use it; otherwise, start a new transaction
  if (!tx) {
    return db.$transaction(async (trx) => {
      return await addEnvironment(environmentInput, ability, trx);
    });
  }

  const dbMutator = tx;

  const newEnvironment = environmentSchema.parse(environmentInput);
  const id = newEnvironment.isOrganization ? newEnvironment.id ?? v4() : newEnvironment.ownerId;

  if (await getEnvironmentById(id)) throw new Error('Environment id already exists');

  const newEnvironmentWithId = { ...newEnvironment, id };
  await dbMutator.space.create({ data: { ...newEnvironmentWithId } });

  if (newEnvironment.isOrganization) {
    const adminRole = await addRole(
      {
        environmentId: id,
        name: '@admin',
        default: true,
        permissions: { All: adminPermissions },
      },
      undefined,
      tx,
    );
    await addRole(
      {
        environmentId: id,
        name: '@guest',
        default: true,
        permissions: {},
      },
      undefined,
      tx,
    );
    await addRole(
      {
        environmentId: id,
        name: '@everyone',
        default: true,
        permissions: {},
      },
      undefined,
      tx,
    );

    if (newEnvironment.isActive) {
      await addMember(id, newEnvironment.ownerId, undefined, tx);

      await addRoleMappings(
        [
          {
            environmentId: id,
            roleId: adminRole.id,
            userId: newEnvironment.ownerId,
          },
        ],
        undefined,
        tx,
      );
    }
  }

  // add root folder
  await createFolder(
    {
      environmentId: id,
      name: '',
      parentId: null,
      createdBy: null,
    },
    undefined,
    tx,
  );

  return newEnvironmentWithId;
}

export async function deleteEnvironment(environmentId: string, ability?: Ability) {
  const environment = await getEnvironmentById(environmentId);
  if (!environment) throw new Error('Environment not found');

  if (ability && !ability.can('delete', 'Environment')) throw new UnauthorizedError();
  await db.space.delete({
    where: { id: environmentId },
  });
}

//TODO organisation logo in db logic

export async function updateOrganization(
  environmentId: string,
  environmentInput: Partial<UserOrganizationEnvironmentInput>,
  ability?: Ability,
) {
  const environment = await getEnvironmentById(environmentId, ability, { throwOnNotFound: true });

  if (!environment) {
    throw new Error('Environment not found');
  }

  if (
    ability &&
    !ability.can('update', toCaslResource('Environment', environment), { environmentId })
  )
    throw new UnauthorizedError();

  if (!environment.isOrganization) throw new Error('Environment is not an organization');

  const update = UserOrganizationEnvironmentInputSchema.partial().parse(environmentInput);
  const newEnvironmentData: Environment = { ...environment, ...update } as Environment;

  await db.space.update({ where: { id: environment.id }, data: { ...newEnvironmentData } });

  return newEnvironmentData;
}

// TODO below: implement db logic

export async function saveSpaceLogo(organizationId: string, image: Buffer, ability?: Ability) {
  const organization = await getEnvironmentById(organizationId, undefined, {
    throwOnNotFound: true,
  });
  if (!organization?.isOrganization)
    throw new Error("You can't save a logo for a personal environment");

  if (ability && ability.can('update', 'Environment', { environmentId: organizationId }))
    throw new UnauthorizedError();

  try {
    //saveLogo(organizationId, image);
  } catch (err) {
    throw new Error('Failed to store image');
  }
}

export async function getSpaceLogo(organizationId: string) {
  try {
    return await db.space.findUnique({
      where: { id: organizationId },
      select: { spaceLogo: true },
    });
  } catch (err) {
    return undefined;
  }
}

export async function spaceHasLogo(organizationId: string) {
  const res = await db.space.findUnique({
    where: { id: organizationId },
    select: { spaceLogo: true },
  });
  if (res?.spaceLogo) {
    return true;
  }
  return false;
}

export async function deleteSpaceLogo(organizationId: string) {
  await getEnvironmentById(organizationId, undefined, {
    throwOnNotFound: true,
  });

  //if (!hasLogo(organizationId)) throw new Error("Organization doesn't have a logo");

  //deleteLogo(organizationId);
}
