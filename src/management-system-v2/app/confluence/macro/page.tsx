import Layout from '@/app/(dashboard)/[environmentId]/layout-client';
import Macro from './macro';
import { getCurrentUser } from '@/components/auth';
import { getEnvironmentById } from '@/lib/data/legacy/iam/environments';
import { getUserOrganizationEnviroments } from '@/lib/data/legacy/iam/memberships';
import { Environment } from '@/lib/data/environment-schema';
import Head from 'next/head';

const MacroPage = async ({ params }: { params: { processId: string } }) => {
  const processId = params.processId;
  console.log('params', params);

  const { session, userId } = await getCurrentUser();

  const userEnvironments: Environment[] = [getEnvironmentById(userId)];
  userEnvironments.push(
    ...getUserOrganizationEnviroments(userId).map((environmentId) =>
      getEnvironmentById(environmentId),
    ),
  );

  return (
    <>
      <Head>
        <title>Proceed Macro Editor</title>
        <script src="https://connect-cdn.atlassian.com/all.js"></script>
      </Head>
      <Layout
        hideSider={true}
        loggedIn={!!userId}
        layoutMenuItems={[]}
        userEnvironments={userEnvironments}
        activeSpace={{ spaceId: userId || '', isOrganization: false }}
      >
        <Macro></Macro>
      </Layout>
    </>
  );
};

export default MacroPage;
