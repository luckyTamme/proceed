'use client';

import { MachineConfig, ParameterContent, ParentConfig } from '@/lib/data/machine-config-schema';
import { useRouter } from 'next/navigation';

import { CaretRightOutlined } from '@ant-design/icons';
import { useMemo, useRef, useState } from 'react';
import { Collapse, theme, Modal, Form, Input, MenuProps } from 'antd';
import ActionButtons from './action-buttons';
import Content from './config-content';
import {
  copyConfig,
  removeMachineConfig,
  updateMachineConfig,
  updateParentConfig,
} from '@/lib/data/legacy/machine-config';

const CopyMachineConfigModal: React.FC<{
  open: boolean;
  onCancel: () => void;
  onConfirm: (name: string, description: string) => Promise<void>;
}> = ({ open, onConfirm, onCancel }) => {
  const [form] = Form.useForm();

  // TODO: on open prefill with current values
  const [currentName, setCurrentName] = useState('');
  const [currentDescription, setCurrentDescription] = useState('');

  return (
    <Modal
      open={open}
      title="Copy Machine Configuration"
      okText="Ok"
      cancelText="Cancel"
      onCancel={onCancel}
      onOk={async () => {
        await form.validateFields();
        await onConfirm(currentName, currentDescription);
        setCurrentName('');
        setCurrentDescription('');
      }}
    >
      <Form form={form} layout="vertical" name="form_in_modal">
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, message: 'Please input the name of the machine configuration!' },
          ]}
        >
          <Input value={currentName} onChange={(e) => setCurrentName(e.target.value)} />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea
            showCount
            rows={4}
            maxLength={150}
            value={currentDescription}
            onChange={(e) => setCurrentDescription(e.target.value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

type MachineDataViewProps = {
  parentConfig: ParentConfig;
  editingEnabled: boolean;
};

const MachineConfigurations: React.FC<MachineDataViewProps> = ({
  parentConfig,
  editingEnabled,
}) => {
  const router = useRouter();

  const [configToCopy, setConfigToCopy] = useState('');
  const machineIds = useRef<string[]>([]);

  const { token } = theme.useToken();
  const panelStyle = {
    marginBottom: 32,
    // background: token.colorFillAlter,
    background: '#e8e9f7',
    borderRadius: token.borderRadiusLG,
    boxShadow:
      '2px 2px 6px -4px rgba(0, 0, 0, 0.12), 4px 4px 16px 0px rgba(0, 0, 0, 0.08), 6px 6px 28px 8px rgba(0, 0, 0, 0.05)',
    //border: 'none',
  };

  const handleCopy = async (name: string, description: string) => {
    const machineConfig = parentConfig.machineConfigs.find(({ id }) => id === configToCopy);
    if (!machineConfig) return;

    const id = await copyConfig(configToCopy, 'machine-config');

    // TODO: update the copy with the correct name and description
    // the description update should be handled in the backend (its not just a field but a content entry of a metadata entry)
    updateMachineConfig(id, { name });

    // add the machine config to the parent config
    await updateParentConfig(parentConfig.id, {
      machineConfigs: [...parentConfig.machineConfigs.map(({ id }) => id), id],
    });
    router.refresh();
    setConfigToCopy('');
  };

  const handleDelete = async (machineConfigId: string) => {
    await removeMachineConfig(machineConfigId);
    router.refresh();
  };

  const items = useMemo(() => {
    let list = [];

    const getMachineConfigContent = (config: MachineConfig) => {
      const contentItems = [];
      if (editingEnabled || Object.keys(config.metadata).length > 0) {
        contentItems.push({
          key: 'meta',
          label: 'Meta Data',
          children: [
            <Content
              contentType="metadata"
              editingEnabled={editingEnabled}
              data={config.metadata}
              configId={config.id}
              configType="machine-config"
              parentConfig={parentConfig}
            />,
          ],
          style: {
            ...panelStyle,
            border: '1px solid #87e8de',
            background: 'rgba(255,255,255,0.9)',
            boxShadow: 'none',
          }, //cyan-3
        });
      }
      if (editingEnabled || (config.parameters && Object.keys(config.parameters).length > 0)) {
        contentItems.push({
          key: 'param',
          label: 'Parameters',
          children: [
            <Content
              contentType="parameters"
              editingEnabled={editingEnabled}
              configId={config.id}
              configType="machine-config"
              data={config.parameters}
              parentConfig={parentConfig}
            />,
          ],
          style: {
            ...panelStyle,
            border: '1px solid #b7eb8f',
            background: 'rgba(255,255,255,0.9)',
            boxShadow: 'none',
          }, //green-3
        });
      }
      return contentItems;
    };

    for (let machineConfig of parentConfig.machineConfigs) {
      const activeKeys = [];
      if (editingEnabled || Object.keys(machineConfig.metadata).length > 0) {
        activeKeys.push('meta');
      }
      if (editingEnabled || Object.keys(machineConfig.parameters).length > 0) {
        activeKeys.push('param');
      }
      list.push({
        key: machineConfig.id,
        label: `Machine Tech Data Set: ${machineConfig.name}`,
        children: [
          <Collapse
            bordered={false}
            expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
            defaultActiveKey={activeKeys}
            style={{
              background: 'none',
            }}
            items={getMachineConfigContent(machineConfig)}
          />,
        ],
        extra: (
          <ActionButtons
            editable={editingEnabled}
            options={['copy', 'delete']}
            actions={{
              copy: () => {
                setConfigToCopy(machineConfig.id);
              },
              delete: () => {
                handleDelete(machineConfig.id);
              },
            }}
          />
        ),

        style: { ...panelStyle, border: '1px solid #adc6ff' }, //geekblue-3
      });
      machineIds.current.push(machineConfig.id);
    }
    return list;
  }, [parentConfig, editingEnabled, panelStyle]);

  return (
    <>
      <Collapse
        bordered={false}
        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        style={{
          background: 'none',
        }}
        items={items}
        defaultActiveKey={machineIds.current}
      />
      <CopyMachineConfigModal
        open={!!configToCopy}
        onConfirm={handleCopy}
        onCancel={() => setConfigToCopy('')}
      />
    </>
  );
};

export default MachineConfigurations;
