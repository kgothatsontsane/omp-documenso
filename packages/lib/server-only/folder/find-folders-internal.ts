import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import type { TFolderType } from '../../types/folder-type';
import { getTeamById } from '../team/get-team';

export interface FindFoldersInternalOptions {
  userId: number;
  teamId: number;
  parentId?: string | null;
  type?: TFolderType;
}

export const findFoldersInternal = async ({ userId, teamId, parentId, type }: FindFoldersInternalOptions) => {
  const team = await getTeamById({ userId, teamId });

  const visibilityFilters = {
    visibility: {
      in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
    },
  };

  const whereClause = {
    AND: [
      { parentId },
      {
        OR: [
          { teamId, ...visibilityFilters },
          { userId, teamId },
        ],
      },
    ],
  };

  try {
    const folders = await prisma.folder.findMany({
      where: {
        ...whereClause,
        ...(type ? { type } : {}),
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });

    // Collapse the per-folder count fan-out (previously 4 queries × folder)
    // into four aggregate queries total, so the cost is flat regardless of
    // how many folders the team has.
    const folderIds = folders.map((folder) => folder.id);

    const [documentCounts, templateCounts, subfolderCounts, allSubfolders] = await Promise.all([
      prisma.envelope.groupBy({
        by: ['folderId'],
        where: {
          type: EnvelopeType.DOCUMENT,
          folderId: { in: folderIds },
          deletedAt: null,
        },
        _count: { _all: true },
      }),
      prisma.envelope.groupBy({
        by: ['folderId'],
        where: {
          type: EnvelopeType.TEMPLATE,
          folderId: { in: folderIds },
          deletedAt: null,
        },
        _count: { _all: true },
      }),
      prisma.folder.groupBy({
        by: ['parentId'],
        where: {
          parentId: { in: folderIds },
          teamId,
          ...visibilityFilters,
        },
        _count: { _all: true },
      }),
      prisma.folder.findMany({
        where: {
          parentId: { in: folderIds },
          teamId,
          ...visibilityFilters,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const documentCountByFolder = new Map(documentCounts.map((c) => [c.folderId, c._count._all]));
    const templateCountByFolder = new Map(templateCounts.map((c) => [c.folderId, c._count._all]));
    const subfolderCountByParent = new Map(subfolderCounts.map((c) => [c.parentId, c._count._all]));
    const subfoldersByParent = new Map<string | null, typeof allSubfolders>();

    for (const subfolder of allSubfolders) {
      const existing = subfoldersByParent.get(subfolder.parentId) ?? [];

      existing.push(subfolder);
      subfoldersByParent.set(subfolder.parentId, existing);
    }

    const foldersWithDetails = folders.map((folder) => {
      const subfolders = subfoldersByParent.get(folder.id) ?? [];

      const subfoldersWithEmptySubfolders = subfolders.map((subfolder) => ({
        ...subfolder,
        subfolders: [],
        _count: {
          documents: 0,
          templates: 0,
          subfolders: 0,
        },
      }));

      return {
        ...folder,
        subfolders: subfoldersWithEmptySubfolders,
        _count: {
          documents: documentCountByFolder.get(folder.id) ?? 0,
          templates: templateCountByFolder.get(folder.id) ?? 0,
          subfolders: subfolderCountByParent.get(folder.id) ?? 0,
        },
      };
    });

    return foldersWithDetails;
  } catch (error) {
    console.error('Error in findFolders:', error);
    throw error;
  }
};
