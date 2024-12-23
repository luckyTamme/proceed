'use client';

import Bar from '@/components/bar';
import { OrganizationEnvironment } from '@/lib/data/environment-schema';
import { App, Button, Space, Typography } from 'antd';
import { FC, useState } from 'react';
import useFuzySearch, { ReplaceKeysWithHighlighted } from '@/lib/useFuzySearch';
import EnvironmentSidePanel from './environments-side-panel';
import ConfirmationButton from '@/components/confirmation-button';
import { useSession } from 'next-auth/react';
import { deleteOrganizationEnvironments } from '@/lib/data/environments';
import { useRouter } from 'next/navigation';
import { AiOutlineClose, AiOutlineDelete } from 'react-icons/ai';
import SelectionActions from '@/components/selection-actions';
import ElementList from '@/components/item-list-view';
import styles from '@/components/item-list-view.module.scss';
import { wrapServerCall } from '@/lib/wrap-server-call';

const highlightedKeys = ['name', 'description'] as const;
export type FilteredEnvironment = ReplaceKeysWithHighlighted<
  OrganizationEnvironment,
  (typeof highlightedKeys)[number]
>;

const EnvironmentsPage: FC<{ organizationEnvironments: OrganizationEnvironment[] }> = ({
  organizationEnvironments,
}) => {
  const app = App.useApp();
  const router = useRouter();

  const { searchQuery, filteredData, setSearchQuery } = useFuzySearch({
    data: organizationEnvironments,
    keys: ['name', 'description'],
    highlightedKeys,
    transformData: (results) => results.map((result) => result.item),
  });

  const [selectedRows, setSelectedRows] = useState<typeof filteredData>([]);
  const selectedRowKeys = selectedRows.map((row) => row.id);
  const selectedRow = selectedRows.at(-1);

  const session = useSession();
  const userId = session.data?.user?.id || '';

  async function deleteEnvironments(environmentIds: string[]) {
    await wrapServerCall({
      fn: () => deleteOrganizationEnvironments(environmentIds),
      onSuccess: () => {
        setSelectedRows([]);
        router.refresh();
        app.message.success(`Environment${environmentIds.length > 1 ? 's' : ''} deleted`);
      },
      app,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', gap: '10px' }}>
      <div style={{ flexGrow: 1 }}>
        <Bar
          leftNode={
            <Space>
              <Button type="primary" href="/create-organization">
                New Organization
              </Button>
              <SelectionActions count={selectedRowKeys.length}>
                <Button type="text" icon={<AiOutlineClose />} onClick={() => setSelectedRows([])} />
                <ConfirmationButton
                  title="Delete Organizations"
                  description={
                    <Space direction="vertical">
                      <Typography.Text>
                        Are you sure you want to delete the selected organizations?
                      </Typography.Text>
                      <Typography.Text type="danger">
                        All processes inside these organizations will be lost.
                      </Typography.Text>
                    </Space>
                  }
                  onConfirm={() => deleteEnvironments(selectedRowKeys)}
                  buttonProps={{
                    icon: <AiOutlineDelete />,
                    disabled: false, // TODO check ability
                    type: 'text',
                  }}
                />
              </SelectionActions>
            </Space>
          }
          searchProps={{
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            placeholder: 'Search Environments',
          }}
        />
        <ElementList<(typeof filteredData)[number]>
          columns={[
            { title: 'Name', render: (_, environment) => environment.name.highlighted },
            {
              title: 'Description',
              render: (_, environment) => environment.description.highlighted,
            },
            {
              dataIndex: 'id',
              key: 'tooltip',
              title: '',
              width: 100,
              render: (id: string, environment) => (
                <ConfirmationButton
                  title="Delete Organization"
                  description={
                    <Space direction="vertical">
                      <Typography.Text>
                        Are you sure you want to delete this organization?
                      </Typography.Text>
                      <Typography.Text type="danger">
                        All processes inside this organization will be lost.
                      </Typography.Text>
                    </Space>
                  }
                  onConfirm={() => deleteEnvironments([id])}
                  canCloseWhileLoading={true}
                  buttonProps={{
                    disabled: environment.id === userId,
                    className: styles.HoverableTableCell,
                    style: {
                      // Otherwise the button stretches the row
                      position: 'absolute',
                      margin: 'auto',
                      top: '0',
                      bottom: '0',
                    },
                    icon: <AiOutlineDelete />,
                    type: 'text',
                  }}
                />
              ),
            },
          ]}
          data={filteredData}
          elementSelection={{
            selectedElements: selectedRows,
            setSelectionElements: (orgs) => setSelectedRows(orgs),
          }}
          tableProps={{
            rowKey: 'id',
            onRow: (row) => ({
              onClick: () => setSelectedRows([row]),
            }),
          }}
        />
      </div>

      <EnvironmentSidePanel environment={selectedRow} />
    </div>
  );
};
export default EnvironmentsPage;
