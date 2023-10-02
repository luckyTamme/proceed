'use client';

import React from 'react';
import styles from './layout.module.scss';
import { FC, PropsWithChildren, useEffect, useState } from 'react';
import {
  Layout as AntLayout,
  Button,
  Col,
  Menu,
  MenuProps,
  Popover,
  Row,
  Space,
  Tooltip,
} from 'antd';
const { SubMenu, Item, Divider, ItemGroup } = Menu;
import {
  DeploymentUnitOutlined,
  FundProjectionScreenOutlined,
  EditOutlined,
  UnorderedListOutlined,
  ProfileOutlined,
  FileAddOutlined,
  PlaySquareOutlined,
  SettingOutlined,
  ApiOutlined,
  UserOutlined,
  StarOutlined,
  MenuOutlined,
  LogoutOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import Logo from '@/public/proceed.svg';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import cn from 'classnames';
import Content from '@/components/content';
import HeaderMenu from '@/components/content-based-header';
import HeaderActions from '@/components/header-actions';
import { useAuthStore } from '@/lib/iam';
import { AuthCan } from '@/lib/iamComponents';
import Link from 'next/link';

type AuthLayoutProps = PropsWithChildren<{
  headerContent: React.ReactNode | undefined;
}>;

const getCurrentScreenSize = () => {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const AuthLayout: FC<PropsWithChildren> = ({ children }) => {
  const router = useRouter();
  const activeSegment = usePathname().split('/')[1] || 'processes';
  const [collapsed, setCollapsed] = useState(false);
  const ability = useAuthStore((state) => state.ability);
  const loggedIn = useAuthStore((state) => state.loggedIn);

  // keys need to be unique <identifier>:<path>
  // identifier can be left out if the path is unique
  const items: MenuProps['items'] = [
    {
      key: 'processLabel:processes',
      label: 'Processes',
      type: 'group',
    },
    {
      key: 'processGroup:processes',
      className:
        'SelectedSegment' /* `${activeSegment === 'processes' ? 'SelectedSegment' : ''}` */,
      icon: (
        <EditOutlined
          onClick={() => {
            router.push(`/processes`);
          }}
        />
      ),
      label: (
        <span
          onClick={() => {
            router.push(`/processes`);
          }}
        >
          Process List
        </span>
      ),
      children: [
        // {
        //   key: 'processes',
        //   icon: <EditOutlined />,
        //   label: 'My Processes',
        // },
        {
          key: 'newProcess:newProcess',
          icon: <FileAddOutlined />,
          label: 'New Process',
          disabled: true,
        },
        {
          key: 'processFavorites',
          icon: <StarOutlined />,
          label: 'Favorites',
          disabled: true,
        },
      ],
    },
    // {
    //   key: 'newProcess',
    //   icon: <FileAddOutlined />,
    //   label: 'New Process',
    //   disabled: true,
    // },
    {
      key: 'templates',
      icon: <ProfileOutlined />,
      label: 'Templates',
      disabled: false,
      children: [
        {
          key: 'newTemplate',
          icon: <FileAddOutlined />,
          label: 'New Template',
          disabled: true,
        },
        {
          key: 'templateFavorites',
          icon: <StarOutlined />,
          label: 'Favorites',
          disabled: true,
        },
      ],
    },
    // {
    //   key: 'execution',
    //   icon: <PlaySquareOutlined />,
    //   label: 'Execution',
    //   disabled: true,
    // },

    // { type: 'divider' },

    // {
    //   key: 'projects',
    //   icon: <FundProjectionScreenOutlined />,
    //   label: 'Projects',
    // },
    // {
    //   key: 'tasklist',
    //   icon: <UnorderedListOutlined />,
    //   label: 'Tasklist',
    //   disabled: true,
    // },

    { type: 'divider' },

    {
      key: 'settings',
      label: 'Settings',
      type: 'group',
    },
    {
      key: 'generalSettings',
      icon: <SettingOutlined />,
      label: 'General Settings',
      disabled: true,
    },
    {
      key: 'plugins',
      icon: <ApiOutlined />,
      label: 'Plugins',
      disabled: true,
    },
    // {
    //   key: 'environments',
    //   icon: <DeploymentUnitOutlined />,
    //   label: 'Environments',
    //   disabled: true,
    // },
  ];
  // const initialHeight = window!.innerHeight;
  // const initialWidth = window!.innerWidth;

  const [screenSize, setScreenSize] = useState(
    {
      height: 1000,
      width: 800,
    } /*
    { width: initialWidth, height: initialHeight }
    Does not seem to work properly on initial load (mobile)
    */,
  );

  useEffect(() => {
    const updateScreenSize = () => {
      setScreenSize(getCurrentScreenSize);
    };
    window.addEventListener('resize', updateScreenSize);

    return () => {
      window.removeEventListener('resize', updateScreenSize);
    };
  }, [screenSize]);

  const [siderOpened, setSiderOpened] = useState(false);

  const changeSiderOpened = () => {
    if (siderOpened) {
      setSiderOpened(false);
    } else {
      setSiderOpened(true);
    }
  };

  useEffect(() => {
    /* This seems to be necessary since mobile does not load properly on initial load / render */
    window!.dispatchEvent(new Event('resize'));
  }, []);

  return (
    <AntLayout>
      <AntLayout.Header
        style={{ backgroundColor: '#fff', borderBottom: '1px solid #eee', display: 'flex' }}
        className={styles.Header}
      >
        {screenSize.width <= 412 ? (
          //PROCEED Icon for mobile view
          <Link href="/processes">
            <Image
              src="/proceed-icon.png"
              alt="PROCEED Logo"
              className={cn(styles.Icon, { [styles.collapsed]: collapsed })}
              width={85}
              height={35}
              priority
            />
          </Link>
        ) : (
          //PROCEED Logo for desktop view
          <Link href="/processes">
            <Image
              src="/proceed.svg"
              alt="PROCEED Logo"
              className={cn(styles.Logo, { [styles.collapsed]: collapsed })}
              width={160}
              height={63}
              priority
            />
          </Link>
        )}

        <HeaderMenu />
        <div style={{ flex: '1' }}></div>
        <Space
          style={{
            justifySelf: 'end',
          }}
        >
          {screenSize.width <= 412 ? (
            // Hamburger menu for mobile view
            <>
              <Button
                type="text"
                size="large"
                style={{ marginTop: '20px', marginLeft: '15px' }}
                icon={<MenuOutlined style={{ fontSize: '170%' }} />}
                onClick={changeSiderOpened}
              />
            </>
          ) : (
            // Logout and User Profile in header for screens larger than 412px
            <>
              <HeaderActions />
            </>
          )}
        </Space>
      </AntLayout.Header>

      <AntLayout>
        {/* //TODO: sider's border is 1 px too far right */}
        <AntLayout.Sider
          style={{
            backgroundColor: '#fff',
            borderRight: '1px solid #eee',
          }}
          className={styles.Sider}
          collapsible
          collapsed={collapsed}
          onCollapse={(collapsed) => setCollapsed(collapsed)}
          trigger={null}
          breakpoint="md"
        >
          {loggedIn ? (
            <Menu
              theme="light"
              mode="inline"
              selectedKeys={[activeSegment]}
              onClick={({ key }) => {
                const path = key.split(':').at(-1);
                router.push(`/${path}`);
              }}
            >
              {ability.can('view', 'Process') || ability.can('view', 'Template') ? (
                <>
                  <ItemGroup key="processes" title="Processes">
                    {ability.can('view', 'Process') ? (
                      <SubMenu
                        key="processes"
                        title={
                          <span
                            onClick={() => {
                              router.push(`/processes`);
                            }}
                          >
                            Process List
                          </span>
                        }
                        className={activeSegment === 'processes' ? 'SelectedSegment' : ''}
                        icon={
                          <EditOutlined
                            onClick={() => {
                              router.push(`/processes`);
                            }}
                          />
                        }
                      >
                        <Item
                          key="newProcess"
                          icon={<FileAddOutlined />}
                          hidden={!ability.can('create', 'Process')}
                        >
                          New Process
                        </Item>
                        <Item key="processFavorites" icon={<StarOutlined />}>
                          Favorites
                        </Item>
                      </SubMenu>
                    ) : null}

                    {ability.can('view', 'Template') ? (
                      <SubMenu key="templates" title="Templates" icon={<ProfileOutlined />}>
                        <Item
                          key="newTemplate"
                          icon={<FileAddOutlined />}
                          hidden={!ability.can('create', 'Template')}
                        >
                          New Template
                        </Item>
                        <Item key="templateFavorites" icon={<StarOutlined />}>
                          Favorites
                        </Item>
                      </SubMenu>
                    ) : null}
                  </ItemGroup>

                  <Divider />
                </>
              ) : null}

              {ability.can('manage', 'User') ||
              ability.can('manage', 'RoleMapping') ||
              ability.can('manage', 'Role') ? (
                <>
                  <ItemGroup key="IAM" title="IAM">
                    <Item
                      key="iam/users"
                      icon={<UserOutlined />}
                      hidden={!ability.can('manage', 'User')}
                    >
                      Users
                    </Item>

                    <Item
                      key="iam/roles"
                      icon={<UnlockOutlined />}
                      hidden={
                        !(ability.can('manage', 'RoleMapping') || ability.can('manage', 'Role'))
                      }
                    >
                      Roles
                    </Item>
                  </ItemGroup>

                  <Divider />
                </>
              ) : null}

              <ItemGroup key="settings" title="Settings">
                <Item key="generalSettings" icon={<SettingOutlined />}>
                  General Settings
                </Item>
                <Item key="plugins" icon={<ApiOutlined />}>
                  Plugins
                </Item>
              </ItemGroup>
            </Menu>
          ) : null}
          {/* <Menu
            theme="light"
            mode="inline"
            selectedKeys={[activeSegment]}
            items={items}
            onClick={({ key }) => {
              router.push(`/${key}`);
            }}
          /> */}
        </AntLayout.Sider>
        <AntLayout className="fit-height">
          <Content>
            <Space
              direction="vertical"
              size="large"
              style={{ display: 'flex', height: '100%' }}
              /* TODO: */
              className="Content"
            >
              <div className={cn(styles.Main, { [styles.collapsed]: collapsed })}>{children}</div>
            </Space>
          </Content>
        </AntLayout>
      </AntLayout>
      <AntLayout.Footer className={cn(styles.Footer)}>
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          © 2023 PROCEED Labs GmbH
        </Space>
      </AntLayout.Footer>
    </AntLayout>
  );
};

export default AuthLayout;
