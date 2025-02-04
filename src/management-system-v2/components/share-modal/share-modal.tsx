'use client';
import { FC, useEffect, useRef, useState, JSX } from 'react';
import { Modal, Button, Tooltip, Divider, Grid, App, Spin, Typography, Tabs, Space } from 'antd';
import {
  ShareAltOutlined,
  LinkOutlined,
  ExportOutlined,
  LeftOutlined,
  RightOutlined,
  CopyOutlined,
  FileImageOutlined,
} from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { getProcess } from '@/lib/data/processes';
import { Process } from '@/lib/data/process-schema';
import { useEnvironment } from '@/components/auth-can';
import { useAddControlCallback } from '@/lib/controls-store';
import { updateShare } from './share-helpers';
import useModelerStateStore from '@/app/(dashboard)/[environmentId]/processes/[processId]/use-modeler-state-store';
import {
  copyProcessImage,
  shareProcessImage,
  shareProcessImageFromXml,
} from '@/lib/process-export/copy-process-image';

import ModelerShareModalOptionPublicLink from './public-link';
import ModelerShareModalOptionEmdedInWeb from './embed-in-web';
import ExportProcess from './export';

type ShareModalProps = {
  process: { name: string; id: string; bpmn: string };
  versions: Process['versions'];
  open: boolean;
  close: () => void;
};
type SharedAsType = 'public' | 'protected';

export const ShareModal: FC<ShareModalProps> = ({
  versions: processVersions,
  process,
  open,
  close,
}) => {
  const processId = useParams().processId as string;
  const environment = useEnvironment();
  const app = App.useApp();
  const breakpoint = Grid.useBreakpoint();
  const modeler = useModelerStateStore((state) => state.modeler);

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const isSharing = useRef(false);

  const [sharedAs, setSharedAs] = useState<SharedAsType>('public');
  const [shareToken, setShareToken] = useState('');
  const [shareTimestamp, setShareTimestamp] = useState(0);
  const [allowIframeTimestamp, setAllowIframeTimestamp] = useState(0);

  const buttonContainerRef = useRef<HTMLDivElement>(null);

  const [checkingIfProcessShared, setCheckingIfProcessShared] = useState(false);
  const checkIfProcessShared = async () => {
    try {
      setCheckingIfProcessShared(true);
      const res = await getProcess(processId as string, environment.spaceId);
      if (!('error' in res)) {
        const { sharedAs, allowIframeTimestamp, shareTimestamp } = res;
        setSharedAs(sharedAs as SharedAsType);
        setShareToken(shareToken);
        setShareTimestamp(shareTimestamp);
        setAllowIframeTimestamp(allowIframeTimestamp);
      }
    } catch (_) {}
    setCheckingIfProcessShared(false);
  };

  const handleCopyXMLToClipboard = async () => {
    const xml = await modeler?.getXML();
    if (xml) {
      navigator.clipboard.writeText(xml);
      app.message.success('Copied to clipboard');
    }
  };

  const mobileShareWrapper = async <T extends (...args: any[]) => any>(
    fn: T,
    args?: Parameters<T>,
  ) => {
    // Avoid two simultaneous shares
    if (isSharing.current) return;
    isSharing.current = true;
    await fn(...(args ? args : []));
    isSharing.current = false;
  };

  const shareProcess = async (sharedAs: 'public' | 'protected') => {
    let url: string | null = null;
    await updateShare(
      {
        processId,
        spaceId: environment.spaceId,
        sharedAs,
      },
      {
        app,
        onSuccess: (_url) => (url = _url ?? null),
      },
    );
    isSharing.current = false;

    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${process.name} | PROCEED`,
          text: 'Here is a shared process for you',
          url,
        });
      } catch (_) {}
    } else {
      navigator.clipboard.writeText(url);
      app.message.success('Copied to clipboard');
    }

    checkIfProcessShared();
  };

  const mobileShareProcessImage = async () => {
    // NOTE: If a modeler happened to be open and the share modal was opened for another process,
    // this would export the wrong process image, however this is currently not possible in the UI
    const result = modeler
      ? await shareProcessImage(modeler)
      : await shareProcessImageFromXml(process.bpmn);

    if (typeof result === 'string') app.message.success(result);
    else if (result === false) app.message.error('Error sharing process as image');
  };

  useEffect(() => {
    checkIfProcessShared();
  }, []);

  const optionsMobile = [
    {
      optionIcon: <LinkOutlined style={{ fontSize: '24px' }} />,
      label: 'Share Process with Public Link',
      optionTitle: 'Share Process with Public Link',
      key: 'share-public-link',
      children: null,
      onClick: () => mobileShareWrapper(shareProcess, ['public']),
    },
    {
      optionIcon: <LinkOutlined style={{ fontSize: '24px' }} />,
      label: 'Share Process for Registered Users',
      optionTitle: 'Share Process for Registered Users',
      key: 'share-protected-link',
      onClick: () => mobileShareWrapper(shareProcess, ['protected']),
    },
    {
      optionIcon: <FileImageOutlined style={{ fontSize: '24px' }} />,
      label: 'Share Process as Image',
      optionTitle: 'Share Process as Image',
      key: 'share-process-as-image',
      children: null,
      onClick: () => mobileShareWrapper(mobileShareProcessImage),
    },
  ];

  const optionsDesktop = [
    {
      optionIcon: <LinkOutlined style={{ fontSize: '24px' }} />,
      label: 'Share Public Link',
      optionTitle: 'Share Public Link',
      key: 'share-public-link',
      children: (
        <ModelerShareModalOptionPublicLink
          sharedAs={sharedAs as SharedAsType}
          shareTimestamp={shareTimestamp}
          refresh={checkIfProcessShared}
          processVersions={processVersions}
        />
      ),
    },
    {
      optionIcon: (
        <span>
          <LeftOutlined style={{ fontSize: '24px' }} />
          <RightOutlined style={{ fontSize: '24px' }} />
        </span>
      ),
      label: 'Embed in Website',
      optionTitle: 'Embed in Website',
      key: 'embed-in-website',
      children: (
        <ModelerShareModalOptionEmdedInWeb
          sharedAs={sharedAs as SharedAsType}
          allowIframeTimestamp={allowIframeTimestamp}
          refresh={checkIfProcessShared}
          processVersions={processVersions}
        />
      ),
    },
    {
      optionIcon: <CopyOutlined style={{ fontSize: '24px' }} />,
      optionTitle: 'Copy Diagram to Clipboard (PNG)',
      label: 'Copy Diagram as PNG',
      key: 'copy-diagram-as-png',
      children: null,
      onClick: async () => {
        try {
          if (await copyProcessImage(modeler!)) app.message.success('Copied to clipboard');
          else
            app.message.info(
              'ClipboardAPI not supported in your browser, download the image instead',
            );
        } catch (err) {
          app.message.error(`${err}`);
        }
      },
    },
    {
      optionIcon: <CopyOutlined style={{ fontSize: '24px' }} />,
      label: 'Copy Diagram as XML',
      optionTitle: 'Copy BPMN to Clipboard (XML)',
      key: 'copy-diagram-as-xml',
      children: null,
      onClick: handleCopyXMLToClipboard,
    },
    {
      optionIcon: <ExportOutlined style={{ fontSize: '24px' }} />,
      label: 'Export as file',
      optionTitle: 'Export as file',
      key: 'export-as-file',
      children: (
        <ExportProcess
          buttonContainerRef={buttonContainerRef}
          // TODO: don't use magic numbers
          active={activeIndex === 4}
          processes={[
            {
              definitionId: process.id,
            },
          ]}
          processVersions={processVersions}
        />
      ),
      // necessary to reset portal button
      destroyInactiveTabPane: true,
    },
  ];

  const tabs: {
    optionIcon: JSX.Element;
    label: string;
    optionTitle: string;
    key: string;
    children?: JSX.Element | null;
    onClick?: () => any;
  }[] = breakpoint.lg ? optionsDesktop : optionsMobile;

  // block controls when modal is open
  useAddControlCallback(
    ['process-list', 'modeler'],
    [
      'selectall',
      'esc',
      'del',
      'copy',
      'paste',
      'enter',
      'cut',
      'export',
      'import',
      'shift+enter',
      'new',
    ],
    (e) => {
      // e.preventDefault();
    },
    { level: 1, blocking: open },
  );

  useAddControlCallback(
    'modeler',
    'control+enter',
    () => {
      const option = tabs[activeIndex];
      if (open && option?.onClick) option.onClick();
    },
    { dependencies: [open, activeIndex], level: 2, blocking: open },
  );
  useAddControlCallback(
    'modeler',
    'left',
    () => {
      if (open) {
        setActiveIndex((prev) =>
          prev - 1 < 0 ? tabs.length - 1 : Math.min(prev - 1, tabs.length),
        );
      }
    },
    { dependencies: [open, activeIndex] },
  );
  useAddControlCallback(
    'modeler',
    'right',
    () => {
      if (open) {
        setActiveIndex((prev) => (prev + 1) % tabs.length);
      }
    },
    { dependencies: [open, activeIndex] },
  );

  return (
    <>
      <Modal
        title={<div style={{ textAlign: 'center' }}>Share</div>}
        open={open}
        width={breakpoint.lg ? 750 : 320}
        closeIcon={false}
        onCancel={close}
        zIndex={200}
        footer={
          <div style={{ display: 'flex', justifyContent: 'end' }}>
            <Button onClick={close} key="close">
              Close
            </Button>
            <div ref={buttonContainerRef} key="open" />
          </div>
        }
      >
        <Spin spinning={checkingIfProcessShared}>
          {/* The Tabs might seem unnecessary, but they keep the state of the components avoiding unnecessary fetches */}
          <Tabs
            items={tabs.map((t, idx) => ({ ...t, key: idx.toString() }))}
            renderTabBar={() => (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: breakpoint.lg ? 'row' : 'column',
                    flexWrap: breakpoint.lg ? 'nowrap' : 'wrap',
                    alignItems: '',
                    justifyContent: 'center',
                    gap: 10,
                    width: '100%',
                  }}
                >
                  {tabs.map((option, index) => (
                    <Button
                      key={index}
                      style={{
                        flex: breakpoint.lg ? '1 1 0' : '', // evenly fill container
                        height: 'auto', // Allow for vertical stretching
                        minHeight: 'min-content',
                        padding: '.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                        whiteSpace: 'normal',
                        textOverflow: 'ellipsis',
                      }}
                      color={index === activeIndex ? 'primary' : 'default'}
                      variant="outlined"
                      onClick={() => {
                        setActiveIndex(index);
                        if ('onClick' in option && option.onClick) option.onClick();
                      }}
                    >
                      {option.optionIcon}
                      <Typography.Text
                        style={{
                          textAlign: 'center',
                          fontSize: '0.75rem',
                        }}
                      >
                        <Tooltip title={breakpoint.lg ? option.optionTitle : ''}>
                          {option.label}
                        </Tooltip>
                      </Typography.Text>
                    </Button>
                  ))}
                </div>

                {breakpoint.lg && activeIndex !== null && optionsDesktop[activeIndex].children && (
                  <Divider />
                )}
              </>
            )}
            activeKey={activeIndex?.toString()}
          />
        </Spin>
      </Modal>
    </>
  );
};

export const ShareModalButton = (props: Omit<ShareModalProps, 'open' | 'close'>) => {
  const [open, setOpen] = useState(false);

  useAddControlCallback('modeler', 'shift+enter', () => setOpen(true), {
    dependencies: [],
  });

  return (
    <>
      <ShareModal {...props} open={open} close={() => setOpen(false)} />
      <Tooltip title="Share">
        <Button icon={<ShareAltOutlined />} onClick={() => setOpen(true)} />
      </Tooltip>
    </>
  );
};
