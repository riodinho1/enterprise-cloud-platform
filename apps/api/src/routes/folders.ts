import { Router } from 'express';
import {
  createFolderSchema,
  updateFolderSchema,
  type CreateFolderInput,
  type FolderInfo,
  type TagInfo,
} from '@ecp/shared';
import { z } from 'zod';
import { isUniqueViolation, type Db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import type { AccessTokens } from '../lib/tokens.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export interface OrganiseDeps {
  db: Db;
  tokens: AccessTokens;
}

const uuid = z.string().uuid();

function parseId(raw: unknown, code: string, message: string): string {
  const result = uuid.safeParse(raw);
  if (!result.success) throw new HttpError(404, code, message);
  return result.data;
}

const folderNotFound = () => new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found');

function toFolder(f: { id: string; name: string; createdAt: Date }): FolderInfo {
  return { id: f.id, name: f.name, createdAt: f.createdAt.toISOString() };
}

// Folders are the user's own filing system: every query is scoped by ownerId and a
// folder that belongs to someone else is indistinguishable from one that does not exist.
export function foldersRouter({ db, tokens }: OrganiseDeps): Router {
  const router = Router();
  router.use(requireAuth(db, tokens));

  router.get('/', async (_req, res) => {
    const user = currentUser(res);
    const folders = await db.folder.findMany({
      where: { ownerId: user.id },
      orderBy: { name: 'asc' },
    });
    res.json({ folders: folders.map(toFolder) });
  });

  router.post('/', validateBody(createFolderSchema), async (req, res) => {
    const user = currentUser(res);
    const { name } = req.body as CreateFolderInput;
    try {
      const folder = await db.folder.create({ data: { ownerId: user.id, name } });
      res.status(201).json({ folder: toFolder(folder) });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, 'FOLDER_EXISTS', 'A folder with this name already exists');
      }
      throw err;
    }
  });

  router.patch('/:id', validateBody(updateFolderSchema), async (req, res) => {
    const user = currentUser(res);
    const id = parseId(req.params.id, 'FOLDER_NOT_FOUND', 'Folder not found');
    const { name } = req.body as CreateFolderInput;
    try {
      const result = await db.folder.updateMany({
        where: { id, ownerId: user.id },
        data: { name },
      });
      if (result.count !== 1) throw folderNotFound();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, 'FOLDER_EXISTS', 'A folder with this name already exists');
      }
      throw err;
    }
    const folder = await db.folder.findFirstOrThrow({ where: { id, ownerId: user.id } });
    res.json({ folder: toFolder(folder) });
  });

  // Deleting a folder un-files its documents (the foreign key is SetNull); nothing is lost.
  router.delete('/:id', async (req, res) => {
    const user = currentUser(res);
    const id = parseId(req.params.id, 'FOLDER_NOT_FOUND', 'Folder not found');
    const result = await db.folder.deleteMany({ where: { id, ownerId: user.id } });
    if (result.count !== 1) throw folderNotFound();
    res.status(204).end();
  });

  return router;
}

export function tagsRouter({ db, tokens }: OrganiseDeps): Router {
  const router = Router();
  router.use(requireAuth(db, tokens));

  router.get('/', async (_req, res) => {
    const user = currentUser(res);
    const tags = await db.tag.findMany({
      where: { ownerId: user.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { documents: { where: { document: { deletedAt: null } } } } } },
    });
    const body: TagInfo[] = tags.map((t) => ({
      id: t.id,
      name: t.name,
      documentCount: t._count.documents,
    }));
    res.json({ tags: body });
  });

  router.delete('/:id', async (req, res) => {
    const user = currentUser(res);
    const id = parseId(req.params.id, 'TAG_NOT_FOUND', 'Tag not found');
    const result = await db.tag.deleteMany({ where: { id, ownerId: user.id } });
    if (result.count !== 1) throw new HttpError(404, 'TAG_NOT_FOUND', 'Tag not found');
    res.status(204).end();
  });

  return router;
}
