'use server';

import { Prisma } from '@prisma/client';
import { getFileCategory, getNewFileName, EntityType } from '../helpers/fileManagerHelpers';
import { contentTypeNotAllowed } from './content-upload-error';
import { deleteFile, retrieveFile, saveFile } from './file-manager';
import db from '@/lib/data';

// Allowed content types for files
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'text/html',
  'application/pdf',
];

const isContentTypeAllowed = (mimeType: string) => {
  return ALLOWED_CONTENT_TYPES.includes(mimeType);
};

const saveArtifactToDB = async (fileName: string, filePath: string, processId: string) => {
  return db.processArtifacts.create({
    data: { fileName, filePath, processId },
  });
};

const removeArtifactFromDB = async (filePath: string, processId: string) => {
  return db.processArtifacts.delete({
    where: { filePath, processId },
  });
};

// Utility to handle file paths for process artifacts
const generateProcessFilePath = (
  fileName: string,
  processId: string,
  mimeType?: string,
): string => {
  const artifactType = getFileCategory(fileName, mimeType);

  if (artifactType === 'images' || artifactType === 'others') {
    return `artifacts/${artifactType}/${fileName}`;
  }

  if (artifactType === 'bpmns') {
    return `processes/${processId}/${fileName}`;
  }

  // user-tasks,scripts
  return `processes/${processId}/${artifactType}/${fileName}`;
};

export async function getProcessArtifactMetaData(fileNameOrPath: string, isFilePath: boolean) {
  return await db.processArtifacts.findUnique({
    where: isFilePath ? { filePath: fileNameOrPath } : { fileName: fileNameOrPath },
    select: { filePath: true, refCounter: true },
  });
}

export async function saveEnityFile(
  entityType: EntityType,
  entityId: string,
  mimeType: string,
  fileName: string,
  fileContent?: Buffer | Uint8Array | Blob,
) {
  if (!isContentTypeAllowed(mimeType)) {
    return contentTypeNotAllowed(`Content type '${mimeType}' is not allowed`);
  }

  switch (entityType) {
    case EntityType.PROCESS:
      return saveProcessArtifact(entityId, mimeType, fileName, fileContent);
    case EntityType.ORGANIZATION:
      return saveOrganisationLogo(fileName, entityId, mimeType, fileContent);
    case EntityType.MACHINE:
    // Extend for other entity types
    default:
      return { presignedUrl: null, fileName: null };
  }
}

export async function retrieveEntityFile(
  entityType: EntityType,
  entityId: string,
  fileName?: string | null,
) {
  switch (entityType) {
    case EntityType.PROCESS:
      return retrieveProcessArtifact(entityId, fileName!);
    case EntityType.ORGANIZATION:
      return getOrganisationLogo(entityId);
    case EntityType.MACHINE:
    // Extend for other entity types
    default:
      return null;
  }
}

export async function deleteEntityFile(
  entityType: EntityType,
  entityId: string,
  fileName?: string,
): Promise<boolean> {
  switch (entityType) {
    case EntityType.PROCESS:
      return deleteProcessArtifact(entityId, fileName!);
    case EntityType.ORGANIZATION:
      return deleteOrganisationLogo(entityId);
    case EntityType.MACHINE:
    // Extend for other entity types
    default:
      return false;
  }
}

// Functionality for handling process artifact files
export async function saveProcessArtifact(
  processId: string,
  mimeType: string,
  fileName: string,
  fileContent?: Buffer | Uint8Array | Blob,
) {
  const newFileName = getNewFileName(fileName);
  const filePath = generateProcessFilePath(newFileName, processId, mimeType);

  const { presignedUrl, status } = await saveFile(filePath, mimeType, fileContent);

  if (status) {
    await saveArtifactToDB(newFileName, filePath, processId);
  }

  return { presignedUrl, fileName: newFileName };
}

export async function retrieveProcessArtifact(
  processId: string,
  fileNameOrPath: string,
  isFilePath = false,
) {
  //TODO: referencing process and referenced procedd validation
  const resp = await getProcessArtifactMetaData(fileNameOrPath, isFilePath);
  if (!resp) {
    throw new Error(`${fileNameOrPath} not found`);
  }
  return retrieveFile(resp.filePath);
}

export async function deleteProcessArtifact(
  processId: string,
  fileNameOrPath: string,
  isFilePath = false,
) {
  const resp = await getProcessArtifactMetaData(fileNameOrPath, isFilePath);
  if (!resp) {
    throw new Error(`${fileNameOrPath} not found`);
  }

  if (resp.refCounter == 0) {
    const isDeleted = await deleteFile(resp.filePath);
    if (isDeleted) {
      await removeArtifactFromDB(resp.filePath, processId);
    }
    return isDeleted;
  } else {
    await db.processArtifacts.update({
      where: isFilePath ? { filePath: fileNameOrPath } : { fileName: fileNameOrPath },
      data: {
        refCounter: { decrement: 1 },
      },
    });

    return true;
  }
}

// Functionality for handling organization logo files

export async function saveOrganisationLogo(
  fileName: string,
  organisationId: string,
  mimeType: string,
  fileContent?: Buffer | Uint8Array | Blob,
) {
  const newFileName = getNewFileName(fileName);
  const filePath = `artifacts/images/${newFileName}`;

  const { presignedUrl, status } = await saveFile(filePath, mimeType, fileContent);

  if (status) {
    await db.space.update({
      where: { id: organisationId },
      data: { logo: filePath },
    });
  }

  return { presignedUrl, fileName: newFileName };
}

export async function getOrganisationLogo(organisationId: string) {
  const result = await db.space.findUnique({
    where: { id: organisationId },
    select: { logo: true },
  });

  if (result?.logo) {
    return retrieveFile(result.logo);
  }

  return null;
}

export async function deleteOrganisationLogo(organisationId: string): Promise<boolean> {
  const result = await db.space.findUnique({
    where: { id: organisationId },
    select: { logo: true },
  });

  if (result?.logo) {
    const isDeleted = await deleteFile(result.logo);
    if (isDeleted) {
      await db.space.update({
        where: { id: organisationId },
        data: { logo: null },
      });
    }
    return isDeleted;
  }

  return false;
}

// Update file status in the database
export async function updateFileDeletableStatus(fileName: string, status: boolean) {
  const artifact = await db.processArtifacts.findUnique({
    where: { fileName },
    select: { refCounter: true },
  });

  if (!artifact) throw new Error('File not found');

  let updateData: Prisma.ProcessArtifactsUpdateInput = {};

  // If refCounter >= 1, deletable must remain false
  if (artifact.refCounter >= 1) {
    updateData = {
      deletable: false,
      refCounter: status ? { decrement: 1 } : { increment: 1 },
    };
  } else if (artifact.refCounter < 1) {
    // If refCounter < 1, allow deletable to change based on the provided status
    updateData = {
      deletable: status,
      deletedOn: new Date(),
      refCounter: status ? { decrement: 1 } : { increment: 1 },
    };
  }

  return await db.processArtifacts.update({
    where: { fileName },
    data: updateData,
  });
}
