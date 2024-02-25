import Ability from '@/lib/ability/abilityHelper.js';
import { Folder, FolderSchema, FolderUserInput, FolderUserInputSchema } from '../folder-schema';
import store from './store.js';
import { toCaslResource } from '@/lib/ability/caslAbility';
import { v4 } from 'uuid';
import { z } from 'zod';

// @ts-ignore
let firstInit = !global.foldersMetaObject;

export let foldersMetaObject: {
  folders: Partial<{ [Id: string]: { folder: Folder; children: Folder[] } }>;
  rootFolders: Partial<{ [environmentId: string]: Folder }>;
} =
  // @ts-ignore
  global.foldersMetaObject || (global.foldersMetaObject = { folders: {}, rootFolders: {} });

/** initializes the folders meta information objects */
export function init() {
  if (!firstInit) return;

  const storedFolders = store.get('folders') as Folder[];
  foldersMetaObject = { folders: {}, rootFolders: {} };

  //first create all the folders
  for (const folder of storedFolders) {
    if (!folder.parentId) {
      if (foldersMetaObject.rootFolders[folder.environmentId])
        throw new Error(`Environment ${folder.environmentId} Multiple root folders`);

      foldersMetaObject.rootFolders[folder.environmentId] = folder;
    }

    foldersMetaObject.folders[folder.id] = { folder, children: [] };
  }

  //populate children
  //children fill their parent's children array
  for (const folder of storedFolders) {
    // skip roots
    if (!folder.parentId) continue;

    const parentData = foldersMetaObject.folders[folder.parentId];
    if (!parentData)
      throw new Error(`Inconsistency in folder structure: folder ${folder.id} has no parent`);

    parentData.children.push(folder);
  }
}
init();

export function getRootFolder(environmentId: string, ability?: Ability) {
  const rootFolder = foldersMetaObject.rootFolders[environmentId];
  if (!rootFolder) throw new Error(`MS Error: environment ${environmentId} has no root folder`);

  if (ability && !ability.can('view', toCaslResource('Folder', rootFolder)))
    throw new Error('Permission denied');

  return rootFolder;
}

export function getFolderById(folderId: string, ability?: Ability) {
  const folderData = foldersMetaObject.folders[folderId];
  if (!folderData) throw new Error('Folder not found');

  if (ability && !ability.can('view', toCaslResource('Folder', folderData.folder)))
    throw new Error('Permission denied');

  return folderData.folder;
}

export function getFolderChildren(folderId: string, ability?: Ability) {
  const folderData = foldersMetaObject.folders[folderId];
  if (!folderData) throw new Error('Folder not found');

  if (ability && !ability.can('view', toCaslResource('Folder', folderData.folder)))
    throw new Error('Permission denied');

  return folderData.children;
}

export function createFolder(folderInput: z.infer<typeof FolderSchema>, ability?: Ability) {
  const folder = FolderSchema.parse(folderInput);
  if (!folder.id) folder.id = v4();

  // Checks
  if (ability && !ability.can('create', toCaslResource('Folder', folder)))
    throw new Error('Permission denied');

  if (foldersMetaObject.folders[folder.id]) throw new Error('Folder already exists');

  const parentFolderData = folder.parentId && foldersMetaObject.folders[folder.parentId];
  if (folder.parentId) {
    if (!parentFolderData) throw new Error('Parent folder does not exist');

    if (parentFolderData.folder.environmentId !== folder.environmentId)
      throw new Error('Parent folder is in a different environment');
  } else {
    if (foldersMetaObject.rootFolders[folder.environmentId])
      throw new Error(`Environment ${folder.environmentId} already has a root folder`);
  }

  // Store
  const newFolder = {
    ...folder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Folder;

  foldersMetaObject.folders[folder.id] = { folder: newFolder, children: [] };

  if (parentFolderData) parentFolderData.children.push(newFolder);
  else foldersMetaObject.rootFolders[newFolder.environmentId] = newFolder;

  store.add('folders', newFolder);

  return newFolder;
}

/** Deletes a folder and every child recursively */
export function deleteFolder(folderId: string, ability?: Ability) {
  // NOTE: maybe the ability should do this recursive check
  const folderData = foldersMetaObject.folders[folderId];
  if (!folderData) throw new Error('Folder not found');

  _deleteFolder(folderData, ability);
}

/** internal function to delete folders from bottom to top */
function _deleteFolder(
  folderData: NonNullable<(typeof foldersMetaObject)['folders'][string]>,
  ability?: Ability,
) {
  if (ability && !ability.can('delete', toCaslResource('Folder', folderData.folder)))
    throw new Error('Permission denied');

  for (const child of folderData.children) {
    const childData = foldersMetaObject.folders[child.id];
    if (!childData) throw new Error('Inconsistency in folder structure: child folder not found');

    _deleteFolder(childData, ability);
  }

  // TODO: remove processes

  delete foldersMetaObject.folders[folderData.folder.id];
  if (!folderData.folder.parentId)
    delete foldersMetaObject.rootFolders[folderData.folder.environmentId];

  store.remove('folders', folderData.folder.id);
}

export function updateFolderMetaData(
  folderId: string,
  newMetaDataInput: Partial<FolderUserInput>,
  ability?: Ability,
) {
  const folderData = foldersMetaObject.folders[folderId];
  if (!folderData) throw new Error('Folder not found');

  if (ability && !ability.can('update', toCaslResource('Folder', folderData.folder)))
    throw new Error('Permission denied');

  const newMetaData = FolderUserInputSchema.partial().parse(newMetaDataInput);

  const newFolder = { ...folderData.folder, ...newMetaData, updatedAt: new Date().toISOString() };

  folderData.folder = newFolder;
  store.update('folders', folderId, newFolder);
}

function isInSubtree(rootId: string, nodeId: string) {
  const folderData = foldersMetaObject.folders[rootId];
  if (!folderData) throw new Error('RootId not found');

  if (!foldersMetaObject.folders[nodeId]) throw new Error('NodeId not found');

  if (rootId === nodeId) return true;

  for (const child of folderData.children) {
    if (isInSubtree(child.id, nodeId)) return true;
  }

  return false;
}

export function moveFolder(folderId: string, newParentId: string, ability?: Ability) {
  const folderData = foldersMetaObject.folders[folderId];
  if (!folderData) throw new Error('Folder not found');

  // Checks
  if (!folderData.folder.parentId) throw new Error('Root folders cannot be moved');
  if (folderData.folder.parentId === newParentId) return;

  const newParentData = foldersMetaObject.folders[newParentId];
  if (!newParentData) throw new Error('New parent folder not found');

  const oldParentData = foldersMetaObject.folders[folderData.folder.parentId];
  if (!oldParentData)
    throw new Error(`Consistency error: current parent folder of ${folderId} not found`);

  const folderIndex = oldParentData.children.findIndex((f) => f.id === folderId);
  if (folderIndex === -1)
    throw new Error("Consistency error: folder not found in parent's children");

  if (
    ability &&
    !ability.can('update', toCaslResource('Folder', folderData.folder)) &&
    !ability.can('update', toCaslResource('Folder', newParentData.folder)) &&
    !ability.can('update', toCaslResource('Folder', oldParentData.folder))
  )
    throw new Error('Permission denied');

  // Folder cannot be movet to it's sub tree
  if (isInSubtree(folderId, newParentId))
    throw new Error("Folder cannot be moved to it's children");

  // Sore
  oldParentData.children.splice(folderIndex, 1);

  folderData.folder.parentId = newParentId;
  newParentData.children.push(folderData.folder);

  store.update('folders', folderId, folderData.folder);
}
