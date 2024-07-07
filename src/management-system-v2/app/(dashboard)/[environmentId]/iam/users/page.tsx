import { getCurrentEnvironment } from '@/components/auth';
import UsersPage from './users-page';
import Content from '@/components/content';
import UnauthorizedFallback from '@/components/unauthorized-fallback';
import { getMemebers } from '@/lib/data/legacy/iam/memberships';
import { getUserById } from '@/lib/data/legacy/iam/users';
import { AuthenticatedUser } from '@/lib/data/user-schema';

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const { ability, activeEnvironment } = await getCurrentEnvironment(params.environmentId);
  console.log('Active env: ', activeEnvironment.spaceId);
  if (!ability.can('manage', 'User')) return <UnauthorizedFallback />;

  const memberships = await getMemebers(activeEnvironment.spaceId, ability);
  const users = (await Promise.all(
    memberships.map((user) => getUserById(user.userId)),
  )) as AuthenticatedUser[];

  return (
    <Content title="Identity and Access Management">
      <UsersPage users={users} />
    </Content>
  );
};

export default Page;
