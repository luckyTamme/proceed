import { getCurrentEnvironment } from '@/components/auth';
import UsersPage from './users-page';
import Content from '@/components/content';
import UnauthorizedFallback from '@/components/unauthorized-fallback';
import { getMembers } from '@/lib/data/DTOs';
import { getUserById } from '@/lib/data/DTOs';
import { AuthenticatedUser } from '@/lib/data/user-schema';

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const { ability, activeEnvironment } = await getCurrentEnvironment(params.environmentId);
  if (!ability.can('manage', 'User')) return <UnauthorizedFallback />;

  const memberships = await getMembers(activeEnvironment.spaceId, ability);
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
