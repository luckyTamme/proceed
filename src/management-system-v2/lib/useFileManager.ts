import { use, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnvironment } from '@/components/auth-can';
import {
  cleanUpFailedUploadEntry,
  deleteEntityFile,
  retrieveEntityFile,
  saveEntityFile,
  updateFileDeletableStatus,
} from './data/file-manager-facade';
import { EntityType } from '@/lib/helpers/fileManagerHelpers';
import { message } from 'antd';
import { EnvVarsContext } from '@/components/env-vars-context';

const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB

interface FileManagerHookProps {
  entityType: EntityType;
  errorToasts?: boolean;
}

interface FileOperationResult {
  ok: boolean;
  filePath?: string;
  fileUrl?: string;
}

export function useFileManager({ entityType, errorToasts = true }: FileManagerHookProps) {
  const queryClient = useQueryClient();
  const { spaceId } = useEnvironment();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const env = use(EnvVarsContext);
  const DEPLOYMENT_ENV = env.PROCEED_PUBLIC_STORAGE_DEPLOYMENT_ENV;

  // Upload Mutation
  const uploadMutation = useMutation<
    { filePath?: string },
    Error,
    {
      file: File | Blob;
      entityId: string;
      filePath?: string;
      onSuccess?: (data: { filePath?: string }) => void;
      onError?: (error: Error) => void;
    }
  >({
    mutationFn: async ({ file, entityId, filePath }) => {
      if (DEPLOYMENT_ENV === 'cloud') {
        const response = await saveEntityFile(
          entityType,
          entityId,
          file.type,
          filePath || (file instanceof File ? file.name : ''),
        );

        if ('error' in response) {
          throw new Error((response.error as Error).message);
        }

        if (!response.presignedUrl) {
          throw new Error('Failed to get presignedUrl');
        }

        try {
          await uploadToCloud(file, response.presignedUrl);
        } catch (e) {
          //if upload fails, delete the artifact from the database
          console.error('Failed to upload file to cloud', e);
          await cleanUpFailedUploadEntry(spaceId, entityId, entityType, filePath!);
        }

        return { filePath: response.filePath };
      } else {
        return await handleLocalUpload(
          entityId,
          file,
          filePath || (file instanceof File ? file.name : undefined),
        );
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['entityFiles', entityType],
      });

      if (variables.onSuccess) {
        variables.onSuccess(data);
      }
    },
    onError: (error, variables) => {
      if (errorToasts) message.error(error.message || 'Upload failed');
      if (variables.onError) {
        variables.onError(error);
      }
    },
  });

  // Download Mutation
  const downloadMutation = useMutation<
    { fileUrl?: string },
    Error,
    {
      entityId: string;
      filePath: string;
      shareToken?: string | null;
      onSuccess?: (data: { fileUrl?: string }) => void;
      onError?: (error: Error) => void;
    }
  >({
    mutationFn: async ({ entityId, filePath, shareToken }) => {
      if (DEPLOYMENT_ENV === 'cloud') {
        try {
          const presignedUrl = await retrieveEntityFile(entityType, entityId, filePath);
          return { fileUrl: presignedUrl as string };
        } catch (error) {
          console.error(
            `Failed to retrieve file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          return { fileUrl: undefined };
        }
      } else {
        const fileUrl = `/api/private/file-manager?${new URLSearchParams({
          environmentId: spaceId,
          entityId: entityId,
          entityType: entityType,
          filePath,
          ...(shareToken ? { shareToken } : {}),
        })}`;

        return { fileUrl };
      }
    },
    onSuccess: (data, variables) => {
      if (data.fileUrl) setFileUrl(data.fileUrl);
      if (variables.onSuccess) {
        variables.onSuccess(data);
      }
    },
    onError: (error, variables) => {
      if (errorToasts) message.error(error.message || 'Download failed');
      if (variables.onError) {
        variables.onError(error);
      }
    },
  });

  // Remove Mutation
  const removeMutation = useMutation<boolean, Error, { entityId: string; filePath?: string }>({
    mutationFn: async ({ entityId, filePath }) => {
      if (entityType === EntityType.PROCESS) {
        if (!filePath) throw new Error('File name is required when deleting process entity type');
        await updateFileDeletableStatus(filePath, true, entityId);
      } else {
        await deleteEntityFile(entityType, entityId, filePath);
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['entityFiles', entityType],
      });
    },
    onError: (error) => {
      if (errorToasts) message.error(error.message || 'Delete failed');
    },
  });

  // Replace Mutation
  const replaceMutation = useMutation<
    FileOperationResult,
    Error,
    {
      file: File | Blob;
      entityId: string;
      oldFilePath?: string;
      newFilePath?: string;
      onSuccess?: (data: { filePath?: string }) => void;
      onError?: (error: Error) => void;
    }
  >({
    mutationFn: async ({ file, entityId, oldFilePath, newFilePath }) => {
      // First remove the old file
      await removeMutation.mutateAsync({ entityId, filePath: oldFilePath });

      // Then upload the new file
      const uploadResult = await uploadMutation.mutateAsync({
        file,
        entityId,
        filePath: newFilePath,
      });

      return {
        ok: true,
        filePath: uploadResult.filePath,
      };
    },
    onSuccess(data, variables) {
      queryClient.invalidateQueries({
        queryKey: ['entityFiles', entityType],
      });

      if (variables.onSuccess) {
        variables.onSuccess(data);
      }
    },
    onError: (error) => {
      if (errorToasts) message.error(error.message || 'Replace failed');
    },
  });

  // Cloud upload helper
  const uploadToCloud = async (file: File | Blob, presignedUrl: string) => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
        'x-goog-content-length-range': `0,${MAX_CONTENT_LENGTH}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed! Status: ${response.status}`);
    }
  };

  // Local upload helper
  const handleLocalUpload = async (entityId: string, file: File | Blob, filePath?: string) => {
    const url = `/api/private/file-manager?${new URLSearchParams({
      environmentId: spaceId,
      entityId,
      entityType,
      ...(filePath ? { filePath } : {}),
    })}`;

    const response = await fetch(url, {
      method: 'PUT',
      body: file,
    });

    if (response.status === 200) {
      return { filePath: await response.text() };
    } else {
      throw new Error('Local upload failed');
    }
  };

  return {
    upload: uploadMutation.mutateAsync,
    download: downloadMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    replace: replaceMutation.mutateAsync,
    isLoading:
      uploadMutation.isPending ||
      downloadMutation.isPending ||
      removeMutation.isPending ||
      replaceMutation.isPending,
    error:
      uploadMutation.error ||
      downloadMutation.error ||
      removeMutation.error ||
      removeMutation.error,
    fileUrl,
  };
}
