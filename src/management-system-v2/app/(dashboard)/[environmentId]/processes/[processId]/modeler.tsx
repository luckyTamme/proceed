'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ModelerToolbar from './modeler-toolbar';
import useModelerStateStore from './use-modeler-state-store';
import { debounce, spaceURL } from '@/lib/utils';
import VersionToolbar from './version-toolbar';
import useMobileModeler from '@/lib/useMobileModeler';
import { updateProcess } from '@/lib/data/processes';
import { App } from 'antd';
import { is as bpmnIs, isAny as bpmnIsAny } from 'bpmn-js/lib/util/ModelUtil';
import BPMNCanvas, { BPMNCanvasProps, BPMNCanvasRef } from '@/components/bpmn-canvas';
import { useEnvironment } from '@/components/auth-can';
import styles from './modeler.module.scss';
import ModelerZoombar from './modeler-zoombar';
import { useAddControlCallback } from '@/lib/controls-store';
import { getMetaDataFromElement } from '@proceed/bpmn-helper';
import {
  revertSoftDeleteProcessUserTask,
  softDeleteProcessUserTask,
  revertSoftDeleteProcessScriptTask,
  softDeleteProcessScriptTask,
  updateFileDeletableStatus,
} from '@/lib/data/file-manager-facade';
import { Process } from '@/lib/data/process-schema';

type ModelerProps = React.HTMLAttributes<HTMLDivElement> & {
  versionName?: string;
  process: Process;
};

export const CanEditContext = createContext<boolean>(true);

export function useCanEdit() {
  return useContext(CanEditContext);
}

const Modeler = ({ versionName, process, ...divProps }: ModelerProps) => {
  const pathname = usePathname();
  const environment = useEnvironment();
  const [xmlEditorBpmn, setXmlEditorBpmn] = useState<string | undefined>(undefined);
  const query = useSearchParams();
  const router = useRouter();
  const { message: messageApi } = App.useApp();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const modeler = useRef<BPMNCanvasRef>(null);

  const setModeler = useModelerStateStore((state) => state.setModeler);
  const setSelectedElementId = useModelerStateStore((state) => state.setSelectedElementId);
  const setRootElement = useModelerStateStore((state) => state.setRootElement);
  const incrementChangeCounter = useModelerStateStore((state) => state.incrementChangeCounter);
  const setZoomLevel = useModelerStateStore((state) => state.setZoomLevel);
  const setFullScreen = useModelerStateStore((state) => state.setFullScreen);

  /* Pressing ESC twice (in 500ms) lets user return to Process List */
  const escCounter = useRef(0);
  useAddControlCallback(
    'modeler',
    'esc',
    () => {
      if (escCounter.current == 1) {
        router.push(spaceURL(environment, `/processes`));
      } else {
        escCounter.current++;
        const timer = setTimeout(() => {
          escCounter.current = 0;
        }, 500);

        setFullScreen(false); // leave fullscreen when pressing ESC

        return () => {
          clearTimeout(timer);
        };
      }
    },
    { dependencies: [router] },
  );

  /// Derived State
  const minimized = !decodeURIComponent(pathname).includes(process.id);

  const selectedVersionId = query.get('version');
  const subprocessId = query.get('subprocess');

  const showMobileView = useMobileModeler();

  const canEdit = !selectedVersionId && !showMobileView;

  const saveDebounced = useMemo(
    () =>
      debounce(async (xml: string, invalidate: boolean = false) => {
        try {
          await updateProcess(
            process.id,
            environment.spaceId,
            xml,
            undefined,
            undefined,
            undefined,
            invalidate,
          );
        } catch (err) {
          console.log(err);
        }
      }, 2000),
    [process.id],
  );

  useEffect(() => {
    console.log('modeler changed');
    setModeler(modeler.current);

    setCanUndo(false);
    setCanRedo(false);

    return () => {
      setModeler(null);
    };
  }, [canEdit, setModeler]);

  const onZoom = useCallback<Required<BPMNCanvasProps>['onZoom']>(
    (zoomLevel) => {
      setZoomLevel(zoomLevel);
    },
    [setZoomLevel],
  );

  const onSelectionChange = useCallback<Required<BPMNCanvasProps>['onSelectionChange']>(
    (oldSelection, newSelection) => {
      if (newSelection.length === 1) {
        setSelectedElementId(newSelection[0].id);
      } else {
        setSelectedElementId(null);
      }
    },
    [setSelectedElementId],
  );

  const onChange = useCallback<Required<BPMNCanvasProps>['onChange']>(async () => {
    // Increment the change counter to trigger a rerender of all components that
    // depend on onChange, but can't use this callback as a child component.
    incrementChangeCounter();

    // Save in the background when the BPMN changes.
    saveDebounced(await modeler.current!.getXML());
    // Update undo/redo state.
    setCanUndo(modeler.current!.canUndo() ?? false);
    setCanRedo(modeler.current!.canRedo() ?? false);
  }, [saveDebounced]);

  const onRootChange = useCallback<Required<BPMNCanvasProps>['onRootChange']>(
    async (root) => {
      console.log('root changed');
      setRootElement(root);
      // When the current root (the visible layer [the main
      // process/collaboration or some collapsed subprocess]) is changed to a
      // subprocess add its id to the query
      const searchParams = new URLSearchParams(window.location.search);
      const before = searchParams.toString();

      let replace = false;
      if (bpmnIs(root, 'bpmn:SubProcess')) {
        searchParams.set(`subprocess`, `${root.businessObject.id}`);
      } else {
        const canvas = modeler.current!.getCanvas();
        const subprocessPlane = canvas
          .getRootElements()
          .find((el: any) => el.businessObject.id === searchParams.get('subprocess'));
        if (searchParams.has('subprocess') && !subprocessPlane) {
          // The subprocess that was open does not exist anymore in this
          // version. Switch to the main process view and replace history
          // instead of push.
          replace = true;
        }
        searchParams.delete('subprocess');
      }

      if (before !== searchParams.toString()) {
        if (replace) {
          router.replace(pathname + '?' + searchParams.toString());
        } else {
          router.push(
            spaceURL(
              environment,
              `/processes/${process.id}${searchParams.size ? '?' + searchParams.toString() : ''}`,
            ),
          );
        }
      }
    },
    [process.id, router, setRootElement],
  );

  const onUnload = useCallback<Required<BPMNCanvasProps>['onUnload']>(
    async (oldInstance) => {
      // TODO: early return if no changes were made.

      // Save the BPMN when the modeler is destroyed (usually when the component
      // is unmounted).
      try {
        // Since this is in cleanup, we can't use ref because it is already null
        // or uses the new instance.
        const { xml } = await oldInstance.saveXML({ format: true });
        // Last save before unloading, so invalidate the client router cache.
        await saveDebounced.asyncImmediate(xml, true).catch((err) => {});
      } catch (err) {
        // Most likely called before the modeler loaded anything. Can ignore.
      }
    },
    [saveDebounced],
  );

  const onLoaded = useCallback<Required<BPMNCanvasProps>['onLoaded']>(() => {
    // stay in the current subprocess when the page or the modeler reloads
    // (unless the subprocess does not exist anymore because the process
    // changed)
    setLoaded(true);
    console.log('onLoaded');
    if (subprocessId && modeler.current) {
      const canvas = modeler.current.getCanvas();
      const subprocessPlane = canvas
        .getRootElements()
        .find((el: any) => el.businessObject.id === subprocessId);
      if (subprocessPlane) {
        canvas.setRootElement(subprocessPlane);
      } else {
        messageApi.info(
          'The sub-process that was open does not exist anymore. Switched to the main process view.',
        );
      }
    }
  }, [messageApi, subprocessId]);

  const onShapeRemove = useCallback<Required<BPMNCanvasProps>['onShapeRemove']>((element) => {
    if (!element.businessObject) return;
    const metaData = getMetaDataFromElement(element.businessObject);
    if (element.type === 'bpmn:UserTask' && element.businessObject.fileName) {
      softDeleteProcessUserTask(process.id, element.businessObject.fileName);
    }
    if (element.type === 'bpmn:ScriptTask' && element.businessObject.fileName) {
      softDeleteProcessScriptTask(process.id, element.businessObject.fileName);
    }
    if (!metaData.overviewImage) {
      return;
    } else {
      updateFileDeletableStatus(metaData.overviewImage, true, process.id);
    }
  }, []);

  const onShapeRemoveUndo = useCallback<Required<BPMNCanvasProps>['onShapeRemoveUndo']>(
    (element) => {
      if (element.$type === 'bpmn:UserTask' && element.fileName) {
        revertSoftDeleteProcessUserTask(process.id, element.fileName);
      }
      if (element.$type === 'bpmn:ScriptTask' && element.fileName) {
        revertSoftDeleteProcessScriptTask(process.id, element.fileName);
      }

      const metaData = getMetaDataFromElement(element);
      if (!metaData.overviewImage) {
        return;
      } else updateFileDeletableStatus(metaData.overviewImage, false, process.id);
    },
    [],
  );

  useEffect(() => {
    if (modeler.current) {
      const canvas = modeler.current.getCanvas();
      const subprocessPlane = canvas
        .getRootElements()
        .find((el: any) => el.businessObject.id === subprocessId);
      if (subprocessPlane) {
        canvas.setRootElement(subprocessPlane);
      } else {
        const processPlane = canvas
          .getRootElements()
          .find((el) => bpmnIsAny(el, ['bpmn:Process', 'bpmn:Collaboration']));
        if (!processPlane) {
          return;
        }
        canvas.setRootElement(processPlane);
      }
    }
  }, [subprocessId]);

  // Create a new object to force rerendering when the bpmn doesn't change.
  const bpmn = useMemo(
    () => ({ bpmn: process.bpmn }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [process.id, selectedVersionId],
  );

  return (
    <CanEditContext.Provider value={canEdit}>
      <div className={styles.Modeler} style={{ height: '100%' }}>
        {!minimized && (
          <>
            {loaded && (
              <ModelerToolbar
                process={process}
                canRedo={canRedo}
                canUndo={canUndo}
                versionName={versionName}
              />
            )}
            {selectedVersionId && !showMobileView && <VersionToolbar processId={process.id} />}
            <ModelerZoombar></ModelerZoombar>
          </>
        )}
        <BPMNCanvas
          ref={modeler}
          type={canEdit ? 'modeler' : 'navigatedviewer'}
          bpmn={bpmn}
          className={divProps.className}
          onLoaded={onLoaded}
          onUnload={canEdit ? onUnload : undefined}
          onRootChange={onRootChange}
          onChange={canEdit ? onChange : undefined}
          onSelectionChange={onSelectionChange}
          onZoom={onZoom}
          onShapeRemove={onShapeRemove}
          onShapeRemoveUndo={onShapeRemoveUndo}
        />
      </div>
    </CanEditContext.Provider>
  );
};

export default Modeler;
