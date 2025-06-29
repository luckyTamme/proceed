import { getCurrentUser } from '@/components/auth';
import UserProfile from './user-profile';
import Content from '@/components/content';
import { getUserById } from '@/lib/data/db/iam/users';
import { notFound } from 'next/navigation';
import { env } from '@/lib/ms-config/env-vars';

const ProfilePage = async () => {
  const { userId } = await getCurrentUser();

  //TODO take guest into consideration

  const userData = await getUserById(userId);

  if (!env.PROCEED_PUBLIC_IAM_ACTIVE) return notFound();

  return (
    <Content>
      <UserProfile userData={userData} />
    </Content>
  );
};

export default ProfilePage;
