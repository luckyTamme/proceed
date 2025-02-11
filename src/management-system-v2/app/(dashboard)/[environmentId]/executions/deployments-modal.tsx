'use client';

import styles from '@/components/item-list-view.module.scss';
import { Space, Button, Grid, Modal, Switch, Dropdown, MenuProps, DropdownProps } from 'antd';
import { UnorderedListOutlined, AppstoreOutlined, DownOutlined } from '@ant-design/icons';
import Bar from '@/components/bar';
import { useUserPreferences } from '@/lib/user-preferences';
import useFuzySearch, { ReplaceKeysWithHighlighted } from '@/lib/useFuzySearch';
import { ProcessMetadata } from '@/lib/data/process-schema';
import { Folder } from '@/lib/data/folder-schema';

import { useInitialiseFavourites } from '@/lib/useFavouriteProcesses';
import ScrollBar from '@/components/scrollbar';
import ProcessIconView from './deployment-selection-icon-view';
import { useState } from 'react';
import { useEnvironment } from '@/components/auth-can';
import { getFolder, getFolderContents } from '@/lib/data/folders';
import { ProcessDeploymentList } from '@/components/process-list';

type InputItem = ProcessMetadata | (Folder & { type: 'folder' });
export type ProcessListProcess = ReplaceKeysWithHighlighted<InputItem, 'name' | 'description'>;

const DeploymentButtons = ({
  isAdvancedView,
  process,
  onDeploy,
}: {
  isAdvancedView: boolean;
  process: ProcessListProcess;
  onDeploy: (process: ProcessListProcess, method?: 'static' | 'dynamic') => void;
}) => {
  return isAdvancedView ? (
    <Space style={{ float: 'right' }}>
      <Button
        type="primary"
        size="small"
        onClick={() => {
          onDeploy(process);
        }}
      >
        Normal
      </Button>
      <Button
        type="primary"
        size="small"
        onClick={() => {
          onDeploy(process, 'static');
        }}
      >
        Static
      </Button>
      <Button
        type="primary"
        size="small"
        onClick={() => {
          onDeploy(process, 'dynamic');
        }}
      >
        Dynamic
      </Button>
    </Space>
  ) : (
    <Button
      style={{ float: 'right' }}
      type="primary"
      size="small"
      onClick={() => {
        onDeploy(process);
      }}
    >
      Deploy Process
    </Button>
  );
};

const DeploymentsModal = ({
  open,
  close,
  processes: initialProcesses,
  favourites,
  folder: initialFolder,
  selectProcess,
}: {
  open: boolean;
  close: () => void;
  processes: InputItem[];
  favourites?: string[];
  folder: Folder;
  selectProcess: (process: ProcessListProcess) => void;
}) => {
  const [isAdvancedView, setIsAdvancedView] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const environment = useEnvironment();

  if (initialFolder.parentId)
    initialProcesses = [
      {
        name: '< Parent Folder >',
        parentId: null,
        type: 'folder',
        id: initialFolder.parentId,
        createdOn: null,
        createdBy: '',
        lastEditedOn: null,
        environmentId: '',
      },
      ...initialProcesses,
    ];

  const [processes, setProcesses] = useState(initialProcesses);

  const [folder, setFolder] = useState(initialFolder);

  const breakpoint = Grid.useBreakpoint();

  const favs = favourites ?? [];
  useInitialiseFavourites(favs);

  const addPreferences = useUserPreferences.use.addPreferences();
  const iconView = useUserPreferences.use['icon-view-in-process-list']();

  const { filteredData, setSearchQuery: setSearchTerm } = useFuzySearch({
    data: processes ?? [],
    keys: ['name', 'description'],
    highlightedKeys: ['name', 'description'],
    transformData: (matches) =>
      matches
        .map((match) => match.item)
        .sort((a, b) => {
          if (a.type === 'folder' && b.type == 'folder') return 0;
          if (a.type === 'folder') return -1;
          if (b.type === 'folder') return 1;

          return 0;
        }),
  });

  const openFolder = async (id: string) => {
    const folder = await getFolder(environment.spaceId, id);
    if ('error' in folder) {
      throw new Error('Failed to fetch folder');
    }

    const folderContents = await getFolderContents(environment.spaceId, folder.id);
    if ('error' in folderContents) {
      throw new Error('Failed to fetch folder children');
    }

    if (folder.parentId) {
      setProcesses([
        {
          name: '< Parent Folder >',
          parentId: null,
          type: 'folder',
          id: folder.parentId,
          createdOn: new Date(),
          createdBy: '',
          lastEditedOn: new Date(),
          environmentId: '',
        },
        ...folderContents,
      ]);
    } else {
      setProcesses(folderContents);
    }
    setFolder(folder);
  };

  const dropdownItems: MenuProps['items'] = [
    {
      key: 1,
      label: (
        <Space>
          <span>Advanced Deployment</span>
          <Switch
            size="small"
            value={isAdvancedView}
            onChange={(checked) => setIsAdvancedView(checked)}
          ></Switch>
        </Space>
      ),
    },
  ];

  const handleOpenChange: DropdownProps['onOpenChange'] = (nextOpen, info) => {
    if (info.source === 'trigger' || nextOpen) {
      setIsDropdownOpen(nextOpen);
    }
  };

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    if (e.key === '3') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <Modal
      width="90vw"
      open={open}
      onCancel={() => close()}
      title={
        <Space size="large">
          <span>Deployment Selection</span>
          <Dropdown
            open={isDropdownOpen}
            onOpenChange={handleOpenChange}
            menu={{ items: dropdownItems, onClick: handleMenuClick }}
          >
            <Button size="small" type="link" style={{ padding: 0 }}>
              <Space>
                Advanced Options
                <DownOutlined />
              </Space>
            </Button>
          </Dropdown>
        </Space>
      }
    >
      <div
        className={breakpoint.xs ? styles.MobileView : ''}
        style={{ display: 'flex', justifyContent: 'space-between', height: '100%' }}
      >
        {/* 73% for list / icon view, 27% for meta data panel (if active) */}
        <div style={{ flex: '1' }}>
          <Bar
            leftNode={
              <span style={{ display: 'flex', width: '100%', justifyContent: 'flex-end' }}>
                <span>
                  <Space.Compact className={breakpoint.xs ? styles.MobileToggleView : undefined}>
                    <Button
                      style={!iconView ? { color: '#3e93de', borderColor: '#3e93de' } : {}}
                      onClick={() => addPreferences({ 'icon-view-in-process-list': false })}
                    >
                      <UnorderedListOutlined />
                    </Button>
                    <Button
                      style={!iconView ? {} : { color: '#3e93de', borderColor: '#3e93de' }}
                      onClick={() => addPreferences({ 'icon-view-in-process-list': true })}
                    >
                      <AppstoreOutlined />
                    </Button>
                  </Space.Compact>
                </span>
              </span>
            }
            searchProps={{
              onChange: (e) => setSearchTerm(e.target.value),
              onPressEnter: (e) => setSearchTerm(e.currentTarget.value),
              placeholder: 'Search Processes ...',
            }}
          />

          {iconView ? (
            <ScrollBar width="12px">
              <ProcessIconView
                data={filteredData}
                openFolder={(id) => {
                  openFolder(id);
                }}
                selectProcess={(id) => {
                  selectProcess(id);
                }}
              ></ProcessIconView>
            </ScrollBar>
          ) : (
            <ProcessDeploymentList
              data={filteredData}
              folder={folder}
              openFolder={(id) => {
                openFolder(id);
              }}
              deploymentButtons={({ process }) => (
                <DeploymentButtons
                  isAdvancedView={isAdvancedView}
                  onDeploy={(processId, method) => {
                    selectProcess(processId);
                  }}
                  process={process}
                ></DeploymentButtons>
              )}
            ></ProcessDeploymentList>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DeploymentsModal;
