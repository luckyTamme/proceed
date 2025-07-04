'use client';

import { Card, Progress, Tag, Typography } from 'antd';
import React, { ReactNode } from 'react';
import styles from './engine-overview.module.scss';

type Engine = {
  name: string;
  description: string;
  online: boolean;
  id: string;
  os: {
    platform: string;
    distro: string;
    release: string;
  };
  cpu: {
    cores: number;
    physicalCores: number;
    processors: number;
    speed: string;
    currentLoad: number;
    loadLastMinute: number;
    loadLastTenMinutes: number;
    loadLastHalfHour: number;
    loadLastHour: number;
    loadLastHalfDay: number;
    loadLastDay: number;
  };
  mem: {
    total: number;
    free: number;
    used: number;
    load: number;
  };
  disk: {
    type: string;
    total: number;
    free: number;
    used: number;
  }[];
  battery: {
    hasBattery: boolean;
    percent: number;
    maxCapacity: number;
  };
  display: {
    currentResX: number;
    currentResY: number;
  }[];
  network: {
    type: string;
    ip4: string;
    netmaskv4: string;
    netmaskv6: string;
    ip6: string;
    mac: string;
  }[];
  outputs: string[];
  port: number;
  hostname: string;
  classes: any[];
  domains: any[];
  inputs: any[];
  onlineCheckingAddresses: string[];
  currentlyConnectedEnvironments: any[];
  acceptUserTasks: boolean;
  deactivateProcessExecution: boolean;
};

function Display({ data }: { data: { title: string; content: ReactNode }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {data.map(({ title, content }) => (
        <div
          style={{ display: 'flex', justifyContent: 'left', gap: '.0rem', flexDirection: 'column' }}
          key={title}
        >
          <Typography.Text type="secondary" style={{ padding: 0 }}>
            {title}
          </Typography.Text>
          {content}
        </div>
      ))}
    </div>
  );
}

function roundNumber(num: number, decimals: number = 2) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export default function EngineOverview({ engine }: { engine: Engine }) {
  return (
    <div className={styles.dashboard}>
      <Card className={styles.basicInfo}>
        <Display
          data={[
            {
              title: 'Name:',
              content: (
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {engine.name}
                </Typography.Title>
              ),
            },
            {
              title: 'Description:',
              content: engine.description,
            },
            {
              title: 'ID:',
              content: engine.id,
            },
          ]}
        />
      </Card>
      <Card className={styles.networkInfo}>
        <Display
          data={[
            {
              title: 'Hostname:',
              content: (
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {engine.hostname}
                </Typography.Title>
              ),
            },
            {
              title: 'Port:',
              content: engine.port,
            },
            {
              title: 'Online',
              content: (
                <Tag color={engine.online ? 'success' : 'error'} style={{ width: 'fit-content' }}>
                  {engine.online ? 'online' : 'offline'}
                </Tag>
              ),
            },
          ]}
        />
      </Card>
      <Card className={styles.operatingSystem}>
        <Display
          data={[
            {
              title: 'Operating System:',
              content: (
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {engine.os.platform}: {engine.os.distro} {engine.os.release}
                </Typography.Title>
              ),
            },
          ]}
        />
      </Card>
      <Card className={styles.ram}>
        <Display
          data={[
            {
              title: 'Memory Usage:',
              content: (
                <div>
                  <Typography.Text style={{ padding: 0 }}>
                    {/** NOTE: maybe use 1024 */}
                    {roundNumber(engine.mem.used / (1000 * 1000 * 1000))} GB /{' '}
                    {roundNumber(engine.mem.total / (1000 * 1000 * 1000))} GB
                  </Typography.Text>

                  <Progress percent={Math.round(engine.mem.load * 100)} />
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Card className={styles.disk}>
        <Display
          data={engine.disk.map(({ total, used, free }, idx) => ({
            title: `Disk ${idx + 1} Usage:`,
            content: (
              <div>
                <Typography.Text style={{ padding: 0 }}>
                  {/** NOTE: maybe use 1024 */}
                  {roundNumber(used / (1000 * 1000 * 1000))} GB /{' '}
                  {roundNumber(total / (1000 * 1000 * 1000))} GB
                </Typography.Text>

                <Progress percent={Math.round((used / free) * 100)} />
              </div>
            ),
          }))}
        />
      </Card>
      {engine.battery.hasBattery && (
        <Card className={styles.battery}>
          <Display
            data={[
              {
                title: 'Battery:',
                content: <Progress percent={engine.battery.percent} status="active" />,
              },
            ]}
          />
        </Card>
      )}

      <Card className={styles.cpu}>
        <Display
          data={[
            {
              title: 'Cores:',
              content: engine.cpu.cores,
            },
            {
              title: 'Physical Cores:',
              content: engine.cpu.physicalCores,
            },
            {
              title: 'Processors:',
              content: engine.cpu.processors,
            },
            {
              title: 'Speed:',
              content: engine.cpu.speed,
            },
            {
              title: 'Current Load:',
              content: `${roundNumber(engine.cpu.currentLoad)}%`,
            },
          ]}
        />
      </Card>

      <Card className={styles.networkDevices}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {engine.network.map((network, idx) => {
            const paragraphStyle = {
              margin: 0,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              maxWidth: '100%',
            } as const;

            return (
              <div style={{ display: 'flex', flexDirection: 'column' }} key={idx}>
                <Typography.Title level={4} style={{ margin: 0, display: 'block' }}>
                  Network {idx + 1}:
                </Typography.Title>
                <Display
                  data={[
                    {
                      title: 'Type:',
                      content: network.type,
                    },
                    {
                      title: 'IPv4:',
                      content: (
                        <>
                          <p style={{ textWrap: 'wrap' }}>{network.ip4}</p>
                          <p style={paragraphStyle}>{network.netmaskv4}</p>
                        </>
                      ),
                    },
                    {
                      title: 'IPv6:',
                      content: (
                        <>
                          <p style={paragraphStyle}>{network.ip6}</p>
                          <p style={paragraphStyle}>{network.netmaskv6}</p>
                        </>
                      ),
                    },
                    {
                      title: 'Mac Address:',
                      content: network.mac,
                    },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
