'use client';

import styles from './layout.module.scss';
import { FC, PropsWithChildren, useState } from 'react';
import { Layout as AntLayout, Grid, Menu } from 'antd';
const { Item, Divider, ItemGroup } = Menu;
import { SettingOutlined, ApiOutlined, UserOutlined, UnlockOutlined } from '@ant-design/icons';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import cn from 'classnames';
import { useAuthStore } from '@/lib/iam';
import Link from 'next/link';
import ProcessSider from './ProcessSider';

/**
 * The main layout of the application. It defines the sidebar and footer. Note
 * that the header is not part of this and instead defined in the Content.tsx
 * component. This is because the header should be customizable by the page,
 * while this component stays the same for all pages.
 *
 * This component is meant to be used in layout.tsx files so it stays out of the
 * page content in parallel routes.
 */
const Layout: FC<PropsWithChildren> = ({ children }) => {
  const activeSegment = usePathname().slice(1) || 'processes';
  const [collapsed, setCollapsed] = useState(false);
  const ability = useAuthStore((state) => state.ability);
  const loggedIn = useAuthStore((state) => state.loggedIn);
  const breakpoint = Grid.useBreakpoint();

  return (
    <AntLayout style={{ height: '100vh' }}>
      <AntLayout hasSider>
        <AntLayout.Sider
          style={{
            backgroundColor: '#fff',
            borderRight: '1px solid #eee',
          }}
          className={styles.Sider}
          collapsible
          collapsed={collapsed}
          onCollapse={(collapsed) => setCollapsed(collapsed)}
          breakpoint="md"
          trigger={null}
        >
          <div className={styles.LogoContainer}>
            <Link href="/processes">
              <Image
                src={breakpoint.xs ? '/proceed-icon.png' : '/proceed.svg'}
                alt="PROCEED Logo"
                className={cn(breakpoint.xs ? styles.Icon : styles.Logo, {
                  [styles.collapsed]: collapsed,
                })}
                width={breakpoint.xs ? 85 : 160}
                height={breakpoint.xs ? 35 : 63}
                priority
              />
            </Link>
          </div>
          {loggedIn ? (
            <Menu theme="light" mode="inline" selectedKeys={[activeSegment]}>
              {ability.can('view', 'Process') || ability.can('view', 'Template') ? (
                <>
                  <ProcessSider></ProcessSider>
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
        </AntLayout.Sider>
        <div className={cn(styles.Main, { [styles.collapsed]: collapsed })}>{children}</div>
      </AntLayout>
      <AntLayout.Footer className={cn(styles.Footer)}>© 2023 PROCEED Labs GmbH</AntLayout.Footer>
    </AntLayout>
  );
};

export default Layout;
