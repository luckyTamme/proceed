'use client';

import styles from './page.module.scss';
import { PropsWithChildren, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import cn from 'classnames';
import Content from '@/components/content';
import Overlay from './overlay';
import {
  BreadcrumbProps,
  Button,
  Divider,
  Select,
  SelectProps,
  Space,
  theme,
  Typography,
} from 'antd';
import { PlusOutlined, LeftOutlined } from '@ant-design/icons';
import useModelerStateStore from '@/lib/use-modeler-state-store';
import useMobileModeler from '@/lib/useMobileModeler';
import ProcessCreationButton from '@/components/process-creation-button';
import { AuthCan } from '@/components/auth-can';
import EllipsisBreadcrumb from '@/components/ellipsis-breadcrumb';

import { is as bpmnIs, isAny as bpmnIsAny } from 'bpmn-js/lib/util/ModelUtil';
import { isExpanded } from 'bpmn-js/lib/util/DiUtil';
import { isPlane } from 'bpmn-js/lib/util/DrilldownUtil';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Canvas from 'diagram-js/lib/core/Canvas';

type SubprocessInfo = {
  id?: string;
  name?: string;
};

type WrapperProps = PropsWithChildren<{
  processName: string;
  processes: { definitionId: string; definitionName: string }[];
}>;

const Wrapper = ({ children, processName, processes }: WrapperProps) => {
  // TODO: check if params is correct after fix release. And maybe don't need
  // refresh in processes.tsx anymore?
  const { processId } = useParams();
  const pathname = usePathname();
  const [closed, setClosed] = useState(false);
  const [subprocessChain, setSubprocessChain] = useState<SubprocessInfo[]>([]);
  const router = useRouter();
  const modeler = useModelerStateStore((state) => state.modeler);

  const {
    token: { fontSizeHeading1 },
  } = theme.useToken();

  /// Derived State
  const minimized = pathname !== `/processes/${processId}`;

  // update the subprocess breadcrumb information if the visible layer in the modeler is changed
  useEffect(() => {
    if (false) {
      modeler.on('root.set', (event: any) => {
        const newSubprocessChain = [] as SubprocessInfo[];

        if (isPlane(event.element)) {
          const elementRegistry = modeler.get('elementRegistry') as ElementRegistry;
          let element = event.element?.businessObject;
          while (bpmnIs(element, 'bpmn:SubProcess')) {
            const shape = elementRegistry.get(element.id);
            // ignore expanded sub-processes that might be in the hierarchy chain
            if (shape && !isExpanded(shape as any)) {
              newSubprocessChain.unshift({ id: element.id, name: element.name });
            }
            element = element.$parent;
          }
        }

        // push a dummy element that represents the root process to generalize the subprocess handling to all possible layers in the modeler
        newSubprocessChain.unshift({
          id: undefined,
          name: undefined,
        });
        setSubprocessChain(newSubprocessChain);
      });
    }
  }, [process, modeler]);

  useEffect(() => {
    // Reset closed state when page is not minimized anymore.
    if (!minimized) {
      setClosed(false);
    }
  }, [minimized]);

  const showMobileView = useMobileModeler();

  const filterOption: SelectProps['filterOption'] = (input, option) =>
    ((option?.label as string) ?? '').toLowerCase().includes(input.toLowerCase());

  const breadcrumbItems: BreadcrumbProps['items'] = showMobileView
    ? [] // avoid unnecessary work in the mobile view
    : [
        /* Processes: */
        {
          title: (
            <Select
              bordered={false}
              popupMatchSelectWidth={false}
              placeholder="Select Process"
              showSearch
              filterOption={filterOption}
              value={{
                value: processId,
                label: 'Process List',
              }}
              // prevents a warning caused by the label for the select element being different from the selected option (https://github.com/ant-design/ant-design/issues/34048#issuecomment-1225491622)
              optionLabelProp="children"
              onSelect={(_, option) => {
                router.push(`/processes/${option.value}`);
              }}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <AuthCan action="create" resource="Process">
                    <Divider style={{ margin: '4px 0' }} />
                    <Space style={{ display: 'flex', justifyContent: 'center' }}>
                      <ProcessCreationButton type="text" icon={<PlusOutlined />}>
                        Create new process
                      </ProcessCreationButton>
                    </Space>
                  </AuthCan>
                </>
              )}
              options={processes?.map(({ definitionId, definitionName }) => ({
                value: definitionId,
                label: definitionName,
              }))}
            />
          ),
        },
        /* (Process/Sub-Process)-Layers */
        ...subprocessChain.slice(0, -1).map(({ id, name }) => {
          const label = id ? name || id : processName || processId || '[Root Layer]';
          return {
            title: (
              <Typography.Text style={{ maxWidth: '8rem' }} ellipsis={{ tooltip: label }}>
                {label}
              </Typography.Text>
            ),
            onClick: async () => {
              // move to the view of another subprocess or the one of the root process
              if (modeler) {
                const canvas = modeler.get('canvas') as Canvas;

                if (id) {
                  // a specific subprocess is supposed to be displayed
                  const subprocessPlane = canvas
                    .getRootElements()
                    .find((el) => el.businessObject.id === id);
                  if (!subprocessPlane) return;
                  canvas.setRootElement(subprocessPlane);
                } else {
                  // no id => show the root process
                  const processPlane = canvas
                    .getRootElements()
                    .find((el) => bpmnIsAny(el, ['bpmn:Process', 'bpmn:Collaboration']));
                  if (!processPlane) return;
                  canvas.setRootElement(processPlane);
                }

                // the logic in zoom does not match the possible argument types (if the second argument is defined but not an object the canvas will automatically define center)
                canvas.zoom('fit-viewport', 'auto' as any);
              }
            },
          };
        }),
      ];

  // add a trailing slash if the name that is displayed in the center of the header is of a subprocess
  if (subprocessChain.length > 1) {
    breadcrumbItems.push({ title: '' });
  }

  if (closed) {
    return null;
  }

  // the name that is displayed in the center of the header
  let currentLayerName = processName || (processId as string);
  // the name of the previous layer or 'Process List' if already in the root layer (only used in the mobile view)
  let backButtonLabel = 'Process List';

  if (subprocessChain.length > 1) {
    const lastEntryIndex = subprocessChain.length - 1;
    // get the name of the last subprocess in the chain (that is the one currently shown in the modeler)
    currentLayerName =
      subprocessChain[lastEntryIndex].name || subprocessChain[lastEntryIndex].id || '[Root Layer]';

    const previousSubprocess = subprocessChain.slice(-2, -1)[0];
    backButtonLabel =
      previousSubprocess?.name || previousSubprocess?.id || processName || '[Root Layer]';
  }

  const currentSubprocess = subprocessChain.slice(-1)[0];

  const handleBackButtonClick = () => {
    if (modeler) {
      const canvas = modeler.get('canvas') as any;

      if (currentSubprocess.id) {
        canvas.setRootElement(canvas.findRoot(currentSubprocess.id));
        canvas.zoom('fit-viewport', 'auto');
      } else {
        router.push('/processes');
      }
    }
  };

  return (
    <Content
      headerLeft={
        <div style={{ flex: 1, padding: '0 5px' }}>
          {showMobileView ? (
            <Button icon={<LeftOutlined />} type="text" onClick={handleBackButtonClick}>
              <Typography.Text
                ellipsis={{ tooltip: backButtonLabel }}
                style={{ maxWidth: '10rem' }}
              >
                {backButtonLabel}
              </Typography.Text>
            </Button>
          ) : (
            <EllipsisBreadcrumb
              keepInFront={2}
              keepInBack={2}
              className={styles.ProcessBreadcrumb}
              style={{ fontSize: fontSizeHeading1, color: 'black' }}
              separator={<span style={{ fontSize: '20px' }}>/</span>}
              items={breadcrumbItems}
            />
          )}
        </div>
      }
      headerCenter={
        <Typography.Text strong style={{ flex: 1, padding: '0 5px' }}>
          {currentLayerName}
        </Typography.Text>
      }
      compact
      wrapperClass={cn(styles.Wrapper, { [styles.minimized]: minimized })}
      headerClass={cn(styles.HF, { [styles.minimizedHF]: minimized })}
    >
      {children}
      {minimized ? (
        <Overlay processId={processId as string} onClose={() => setClosed(true)} />
      ) : null}
    </Content>
  );
};

export default Wrapper;
