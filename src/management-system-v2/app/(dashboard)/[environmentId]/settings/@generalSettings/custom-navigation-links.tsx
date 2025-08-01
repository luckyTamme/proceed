'use client';

import { useState } from 'react';
import { Button, Table, Checkbox, Space, Popconfirm, TableProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import CustomLinkModal from './custom-navigation-link-modal';
import { customLinkIcons } from '@/lib/custom-links/icons';
import { CustomNavigationLink } from '@/lib/custom-links/custom-link';

const CustomNavigationLinks = ({
  values,
  onUpdate,
}: {
  values: CustomNavigationLink[];
  onUpdate: (changedValue: any) => any;
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLinkIdx, setEditingLinkIdx] = useState<number | undefined>();

  const showModal = () => {
    setModalOpen(true);
  };

  function handleModalData(data?: CustomNavigationLink) {
    setModalOpen(false);
    setEditingLinkIdx(undefined);

    if (data) {
      if (editingLinkIdx === undefined) {
        onUpdate(values.concat(data));
      } else {
        const newValues = values.map((previousItem, index) =>
          index === editingLinkIdx ? data : previousItem,
        );
        onUpdate(newValues);
      }
    }
  }

  const handleDelete = async (idx: number) => {
    const newValues = values.filter((_, index) => index !== idx);
    onUpdate(newValues);
  };

  const columns: TableProps['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => {
        const iconOption = customLinkIcons.find((opt) => opt.value === record.icon);
        return (
          <Space>
            {iconOption?.icon} {record.name}
          </Space>
        );
      },
    },
    { title: 'Address', dataIndex: 'address', key: 'address' },
    {
      title: 'Show Status',
      dataIndex: 'showStatus',
      key: 'showStatus',
      render: (show: boolean) => <Checkbox checked={show} disabled />,
    },
    {
      title: 'Clickable',
      dataIndex: 'clickable',
      key: 'clickable',
      render: (show: boolean) => <Checkbox checked={show} disabled />,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, __, idx) => (
        <Space size="middle">
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setModalOpen(true);
              setEditingLinkIdx(idx);
            }}
          >
            Edit
          </Button>
          <Popconfirm title="Sure to delete?" onConfirm={() => handleDelete(idx)}>
            <Button icon={<DeleteOutlined />} danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => showModal()}
        style={{ marginBottom: 16 }}
      >
        Add Link
      </Button>

      <Table
        columns={columns}
        dataSource={values}
        rowKey="id"
        pagination={{ position: ['bottomCenter'] }}
      />

      <CustomLinkModal
        title={editingLinkIdx !== undefined ? 'Edit Navigation Link' : 'Add Navigation Link'}
        open={modalOpen}
        close={handleModalData}
        initialData={editingLinkIdx !== undefined ? values[editingLinkIdx] : undefined}
      />
    </>
  );
};

export default CustomNavigationLinks;
