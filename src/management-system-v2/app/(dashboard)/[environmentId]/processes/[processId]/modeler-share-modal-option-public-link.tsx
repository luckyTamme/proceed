'use client';
import { App, Button, Checkbox, Col, Flex, Input, QRCode, Row, Select, Space } from 'antd';
import { DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  generateSharedViewerUrl,
  updateProcessGuestAccessRights,
} from '@/lib/sharing/process-sharing';
import { useEnvironment } from '@/components/auth-can';
import { IoOpenOutline } from 'react-icons/io5';

import { Process } from '@/lib/data/process-schema';
import { wrapServerCall } from '@/lib/wrap-server-call';
import { isUserErrorResponse } from '@/lib/user-error';

type ModelerShareModalOptionPublicLinkProps = {
  sharedAs: 'public' | 'protected';
  shareTimestamp: number;
  refresh: () => void;
  processVersions: Process['versions'];
};

const ModelerShareModalOptionPublicLink = ({
  sharedAs,
  shareTimestamp,
  refresh,
  processVersions,
}: ModelerShareModalOptionPublicLinkProps) => {
  const { processId } = useParams();
  const query = useSearchParams();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(() => {
    const queryVersion = query.get('version');
    if (queryVersion && processVersions.find((version) => version.id === queryVersion))
      return queryVersion;
    else return processVersions[0]?.id;
  });
  const environment = useEnvironment();

  const [shareLink, setShareLink] = useState('');
  const [registeredUsersonlyChecked, setRegisteredUsersonlyChecked] = useState(
    sharedAs === 'protected',
  );
  const app = App.useApp();

  const isShareLinkChecked = shareTimestamp > 0;
  const isShareLinkEmpty = shareLink.length === 0;

  useEffect(() => {
    if (isShareLinkChecked) {
      wrapServerCall({
        fn: () =>
          generateSharedViewerUrl(
            { processId, timestamp: shareTimestamp },
            selectedVersionId || undefined,
          ),
        onSuccess: (url) => setShareLink(url),
        app,
      });
    }
    setRegisteredUsersonlyChecked(sharedAs === 'protected');
  }, [sharedAs, shareTimestamp, processId, selectedVersionId, isShareLinkChecked, app]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      app.message.success('Link Copied');
    } catch (err) {
      app.message.error('Error copying link');
    }
  };

  const handlePermissionChanged = async (e: {
    target: { checked: boolean | ((prevState: boolean) => boolean) };
  }) => {
    const isChecked = e.target.checked as boolean;
    setRegisteredUsersonlyChecked(isChecked);
    if (isShareLinkChecked) {
      const sharedAsValue = isChecked ? 'protected' : 'public';
      await updateProcessGuestAccessRights(
        processId,
        {
          sharedAs: sharedAsValue,
        },
        environment.spaceId,
      );
    }
    refresh();
  };

  const handleShareLinkChecked = async (e: {
    target: { checked: boolean | ((prevState: boolean) => boolean) };
  }) => {
    const isChecked = e.target.checked;

    if (isChecked) {
      // share process
      const timestamp = Date.now();
      await wrapServerCall({
        fn: async () => {
          const url = generateSharedViewerUrl(
            { processId: processId, timestamp },
            // if there is a specific process version open in the modeler then link to that version (otherwise latest will be shown)
            selectedVersionId || undefined,
          );
          if (isUserErrorResponse(url)) return url;

          const updateRightsResult = await updateProcessGuestAccessRights(
            processId,
            {
              sharedAs: 'public',
              shareTimestamp: timestamp,
            },
            environment.spaceId,
          );
          if (isUserErrorResponse(updateRightsResult)) return updateRightsResult;

          return url;
        },
        onSuccess: (url) => {
          setShareLink(url);
          app.message.success('Process shared');
        },
        app,
      });
    } else {
      // deactivate sharing
      await wrapServerCall({
        fn: () =>
          updateProcessGuestAccessRights(processId, { shareTimestamp: 0 }, environment.spaceId),
        onSuccess: () => {
          setRegisteredUsersonlyChecked(false);
          setShareLink('');
          app.message.success('Process unshared');
        },
        app,
      });
    }
    refresh();
  };

  const canvasRef = useRef<HTMLDivElement>(null);

  const getQRCodeBlob = async () => {
    try {
      const canvas = canvasRef.current?.querySelector<HTMLCanvasElement>('canvas');

      if (!canvas) {
        throw new Error('QR Code canvas not found');
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

      if (!blob) {
        throw new Error('Failed to create PNG blob');
      }

      return blob;
    } catch (err) {
      throw new Error(`${err}`);
    }
  };

  const handleQRCodeAction = async (action: 'download' | 'copy') => {
    try {
      if (action === 'copy') {
        const item = new ClipboardItem({ 'image/png': await getQRCodeBlob() });
        await navigator.clipboard.write([item]);
        app.message.success('QR Code copied as PNG');
      } else if (action === 'download') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(await getQRCodeBlob());
        a.download = 'qrcode.png';
        a.click();
      } else {
        throw new Error('Invalid action specified');
      }
    } catch (err: any) {
      if (err instanceof ReferenceError)
        app.message.info(`ClipboardAPI not supported in your browser`);
      else app.message.error(`${err}`);
    }
  };

  const handleOpenSharedPage = async () => {
    if (shareTimestamp) {
      await wrapServerCall({
        fn: () =>
          generateSharedViewerUrl(
            { processId, timestamp: shareTimestamp },
            selectedVersionId || undefined,
          ),
        onSuccess: (url) => window.open(url, `${processId}-${selectedVersionId}-tab`),
      });
    }
  };

  return (
    <Space direction="vertical" style={{ gap: '1rem', width: '100%' }}>
      <Checkbox checked={isShareLinkChecked} onChange={handleShareLinkChecked}>
        Share Process with Public Link
      </Checkbox>

      <Checkbox
        checked={registeredUsersonlyChecked}
        onChange={handlePermissionChanged}
        disabled={isShareLinkEmpty}
      >
        Visible only for registered user
      </Checkbox>

      {isShareLinkChecked && (
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <Select
            defaultValue={selectedVersionId || '-1'}
            options={[
              { value: '-1', label: 'Latest Version' },
              ...processVersions.map((version) => ({ value: version.id, label: version.name })),
            ]}
            onChange={(value) => {
              setSelectedVersionId(value === '-1' ? null : value);
            }}
            style={{ width: '35 %' }}
          />
          <Button onClick={handleOpenSharedPage} icon={<IoOpenOutline />}>
            Open Preview
          </Button>
        </div>
      )}

      {isShareLinkChecked && (
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <Button
            onClick={handleCopyLink}
            icon={<CopyOutlined />}
            style={{ justifyContent: 'start' }}
          >
            Copy Link
          </Button>
          <Input type={'text'} value={shareLink} style={{ flexGrow: 1 }} />
        </div>
      )}

      {isShareLinkChecked && (
        <div style={{ display: 'flex', width: '100%', gap: '.5rem', alignItems: 'center' }}>
          <QRCode value={shareLink} type="svg" bordered={false} icon="/proceed-icon.png" />
          {/** svg looks has better resolution, but is way harder to copy to the clipboard, that's why we have a hidden qr code */}
          <div id="qrcode" ref={canvasRef} style={{ display: 'none' }}>
            <QRCode
              size={300}
              value={shareLink}
              type="canvas"
              bordered={false}
              icon="/proceed-icon.png"
            />
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                width: 'min-content',
                gap: '0.5rem',
              }}
            >
              <Button
                icon={<DownloadOutlined />}
                title="Save as PNG"
                onClick={() => handleQRCodeAction('download')}
                disabled={isShareLinkEmpty}
              >
                Save QR Code
              </Button>
              <Button
                icon={<CopyOutlined />}
                title="Copy as PNG"
                onClick={() => handleQRCodeAction('copy')}
                disabled={isShareLinkEmpty}
              >
                Copy QR Code
              </Button>
            </div>
          </div>
        </div>
      )}
    </Space>
  );
};

export default ModelerShareModalOptionPublicLink;
