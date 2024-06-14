import { describe, test, expect } from '@jest/globals';
import {
  ResourceActionType,
  ResourceType,
  TreeMap,
  buildAbility,
  resourceAction,
  toCaslResource,
} from '@/lib/ability/caslAbility';
import { SubjectType } from '@casl/ability';

/**
 * Mocked folders:
 *
 * ─1-0:root
 *  │─1-1:a
 *  │ │─1-5:ax
 *  │ │─1-6:ay
 *  │ │─1-7:az
 *  │─1-2:b
 *  │ │─1-8:bx
 *  │ │─1-9:by
 *  │ │─1-10:bz
 *  │─1-3:c
 *  │ │─1-11:cx
 *  │ │─1-12:cy
 *  │ │─1-13:cz
 *  │─1-4:d
 *  │ │─1-14:dx
 *  │ │─1-15:dy
 *  │ │─1-16:dz
 *
 */

const folderTree = {
  // '1-0': undefined,
  '1-1': '1-0',
  '1-5': '1-1',
  '1-6': '1-1',
  '1-7': '1-1',
  '1-2': '1-0',
  '1-8': '1-2',
  '1-9': '1-2',
  '1-10': '1-2',
  '1-3': '1-0',
  '1-11': '1-3',
  '1-12': '1-3',
  '1-13': '1-3',
  '1-4': '1-0',
  '1-14': '1-4',
  '1-15': '1-4',
  '1-16': '1-4',
} as const;

const getAbility = ({
  action,
  subject,
  hasToBeChildOf,
  tree = folderTree,
}: {
  action: ResourceActionType[];
  subject: ResourceType[];
  hasToBeChildOf?: keyof typeof folderTree;
  tree?: TreeMap;
}) =>
  buildAbility(
    [
      {
        action,
        subject,
        conditions: {
          conditions: {
            id: { $propety_has_to_be_child_of: hasToBeChildOf },
          },
        },
      },
    ],
    tree,
  );

describe('Scoped abilities', () => {
  test('Basic implementation details', () => {
    const ability = getAbility({
      action: ['create'],
      subject: ['Folder'],
      hasToBeChildOf: '1-4',
    });

    // test resource type
    expect(ability.can('create', 'Folder')).toBe(true);
  });

  test('Throw error when no tree is passed but needed', () => {
    const ability = buildAbility([
      {
        action: 'update',
        subject: 'Folder',
        conditions: {
          conditions: {
            hola: { $propety_has_to_be_child_of: '1-4' },
          },
        },
      },
    ]);

    expect(() =>
      ability.can('update', toCaslResource('Folder', { id: '000', parentId: '1-4' })),
    ).toThrow();

    // since toCaslResource wasn't used -> no way to identify the resource
    expect(ability.can('update', { id: '000', parentId: '1-4' })).toBe(false);
  });

  test('Test folder actions on rule scoped to that folder', () => {
    const ability = getAbility({
      action: ['delete', 'update'],
      subject: ['Folder'],
      hasToBeChildOf: '1-4',
    });

    expect(ability.can('update', toCaslResource('Folder', { id: '1-4' }))).toBe(true);
    expect(ability.can('update', toCaslResource('Folder', { id: '1-4' }))).toBe(true);
  });

  test('Resource with no parentId', () => {
    const ability = getAbility({
      action: ['admin'],
      subject: ['All'],
      hasToBeChildOf: '1-4',
    });

    for (const action of resourceAction)
      expect(ability.can(action, toCaslResource('Folder', {}))).toBe(false);
  });

  test('Actions in subfolders', () => {
    const ability = getAbility({
      action: ['create', 'update'],
      subject: ['Folder'],
      hasToBeChildOf: '1-4',
    });

    expect(ability.can('create', toCaslResource('Folder', { parentId: '1-4' }))).toBe(true);
    expect(ability.can('update', toCaslResource('Folder', { parentId: '1-4' }))).toBe(true);
  });

  test('Actions outside subfolder', () => {
    const ability = getAbility({
      action: ['update'],
      subject: ['Folder'],
      hasToBeChildOf: '1-4',
    });

    expect(ability.can('create', toCaslResource('Folder', { parentId: '1-3' }))).toBe(false);
    expect(ability.can('create', toCaslResource('Folder', { parentId: '1-1' }))).toBe(false);
    expect(ability.can('create', toCaslResource('Folder', { parentId: '1-0' }))).toBe(false);
    expect(ability.can('create', toCaslResource('Folder', { parentId: '1-7' }))).toBe(false);
  });
});
