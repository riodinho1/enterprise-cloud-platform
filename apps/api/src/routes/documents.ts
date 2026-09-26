import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import busboy from 'busboy';
import { Router, type Request } from 'express';
import {
  listDocumentsQuerySchema,
  updateDocumentSchema,
  type DocumentListResponse,
  type UpdateDocumentInput,
} from '@ecp/shared';
import { z } from 'zod';
import type { Config } from '../config.js';
import type { Db } from '../db.js';
import { recordAudit } from '../lib/audit.js';
import {
  documentInclude,
  findOwnedDocument,
  listOwnedDocuments,
  ownsFolder,
  setDocumentTags,
  softDeleteOwnedDocument,
  toMetadata,
} from '../lib/documents.js';
import { HttpError } from '../lib/errors.js';
import type { Storage } from '../lib/storage.js';
import type { AccessTokens } from '../lib/tokens.js';
import {
  SAMPLE_BYTES,
  checkFileType,
  digestStream,
  peekStream,
  sanitizeFilename,
} from '../lib/uploads.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export interface DocumentDeps {
  db: Db;
  storage: Storage;
  tokens: AccessTokens;
  config: Config;
}

const uuid = z.string().uuid();

// Decision D8: a malformed or unknown ID and someone else's document all look the same.
function notFound(): HttpError {
  return new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
}

function parseId(raw: unknown): string {
  const result = uuid.safeParse(raw);
  if (!result.success) throw notFound();
  return result.data;
}

interface StoredUpload {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

// Streams the single multipart file through type detection, hashing and the
// storage upload without ever holding the whole file in memory.
function receiveUpload(req: Request, storage: Storage, maxBytes: number): Promise<StoredUpload> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sawFile = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      req.unpipe(parser);
      req.resume();
      reject(err);
    };
    const parser = busboy({
      headers: req.headers,
      // Browsers send filenames as raw UTF-8; busboy assumes Latin-1 unless told otherwise.
      defParamCharset: 'utf8',
      limits: { files: 1, fileSize: maxBytes, fields: 0, parts: 2 },
    });

    parser.on('file', (_field, file, info) => {
      sawFile = true;
      void (async () => {
        const originalName = sanitizeFilename(info.filename);
        const { sample, stream } = await peekStream(file, SAMPLE_BYTES);
        const type = await checkFileType(sample, originalName);
        if (!type.ok) {
          file.resume();
          throw new HttpError(415, type.code, 'File type is not allowed', {
            detected: type.detected ?? null,
          });
        }
        const storageKey = randomUUID();
        const digest = digestStream();
        await Promise.all([
          storage.putStream(storageKey, digest.stream, type.mimeType),
          pipeline(stream, digest.stream),
        ]);
        if (file.truncated) {
          await storage.deleteObject(storageKey).catch(() => undefined);
          throw new HttpError(413, 'FILE_TOO_LARGE', `File exceeds ${maxBytes} bytes`);
        }
        const { sha256, sizeBytes } = digest.result();
        settled = true;
        resolve({ storageKey, originalName, mimeType: type.mimeType, sizeBytes, sha256 });
      })().catch(fail);
    });
    parser.on('filesLimit', () => fail(new HttpError(400, 'ONE_FILE_ONLY', 'Upload one file')));
    parser.on('error', fail);
    parser.on('close', () => {
      if (!sawFile) fail(new HttpError(400, 'FILE_REQUIRED', 'A file field is required'));
    });
    req.pipe(parser);
  });
}

export function documentsRouter({ db, storage, tokens, config }: DocumentDeps): Router {
  const router = Router();
  router.use(requireAuth(db, tokens));

  router.post('/', async (req, res) => {
    const user = currentUser(res);
    const folderId = req.query.folderId;
    if (folderId !== undefined) {
      const parsed = uuid.safeParse(folderId);
      if (!parsed.success || !(await ownsFolder(db, user.id, parsed.data))) {
        throw new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found');
      }
    }
    const declared = Number(req.get('content-length') ?? 0);
    if (declared > config.UPLOAD_MAX_BYTES + 4096) {
      throw new HttpError(413, 'FILE_TOO_LARGE', `File exceeds ${config.UPLOAD_MAX_BYTES} bytes`);
    }

    const stored = await receiveUpload(req, storage, config.UPLOAD_MAX_BYTES);
    const scanStatus = config.MALWARE_SCAN === 'off' ? 'CLEAN' : 'PENDING_SCAN';
    let doc;
    try {
      doc = await db.document.create({
        data: {
          ownerId: user.id,
          folderId: typeof folderId === 'string' ? folderId : null,
          storageKey: stored.storageKey,
          originalName: stored.originalName,
          sizeBytes: stored.sizeBytes,
          mimeType: stored.mimeType,
          checksumSha256: stored.sha256,
          scanStatus,
        },
        include: documentInclude,
      });
    } catch (err) {
      // No metadata row means no way to reach the object: remove it rather than leak storage.
      await storage.deleteObject(stored.storageKey).catch(() => undefined);
      throw err;
    }
    await recordAudit(db, req, {
      actorId: user.id,
      action: 'UPLOAD',
      targetType: 'document',
      targetId: doc.id,
      result: 'SUCCESS',
      metadata: {
        name: doc.originalName,
        sizeBytes: doc.sizeBytes,
        mimeType: doc.mimeType,
        sha256: doc.checksumSha256,
        scan: scanStatus,
      },
    });
    res.status(201).json({ document: toMetadata(doc) });
  });

  router.get('/', async (req, res) => {
    const user = currentUser(res);
    const parsed = listDocumentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Query is invalid', parsed.error.issues);
    }
    const { items, total } = await listOwnedDocuments(db, user.id, parsed.data);
    const body: DocumentListResponse = {
      items,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      total,
    };
    res.json(body);
  });

  router.get('/:id', async (req, res) => {
    const user = currentUser(res);
    const doc = await findOwnedDocument(db, user.id, parseId(req.params.id));
    if (!doc) throw notFound();
    res.json({ document: toMetadata(doc) });
  });

  router.patch('/:id', validateBody(updateDocumentSchema), async (req, res) => {
    const user = currentUser(res);
    const id = parseId(req.params.id);
    const input = req.body as UpdateDocumentInput;
    const existing = await findOwnedDocument(db, user.id, id);
    if (!existing) throw notFound();
    if (input.folderId && !(await ownsFolder(db, user.id, input.folderId))) {
      throw new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found');
    }

    const doc = await db.$transaction(async (tx) => {
      if (input.tags) await setDocumentTags(tx, user.id, id, input.tags);
      return tx.document.update({
        where: { id },
        data: {
          ...(input.originalName !== undefined
            ? { originalName: sanitizeFilename(input.originalName) }
            : {}),
          ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
        },
        include: documentInclude,
      });
    });
    res.json({ document: toMetadata(doc) });
  });

  router.delete('/:id', async (req, res) => {
    const user = currentUser(res);
    const id = parseId(req.params.id);
    // Soft delete: the row and the object stay for recovery; a later job purges the bytes.
    const deleted = await softDeleteOwnedDocument(db, user.id, id);
    if (!deleted) throw notFound();
    await recordAudit(db, req, {
      actorId: user.id,
      action: 'DELETE',
      targetType: 'document',
      targetId: id,
      result: 'SUCCESS',
    });
    res.status(204).end();
  });

  router.get('/:id/download', async (req, res) => {
    const user = currentUser(res);
    const doc = await findOwnedDocument(db, user.id, parseId(req.params.id));
    if (!doc) throw notFound();
    if (doc.scanStatus === 'QUARANTINED') {
      throw new HttpError(403, 'FILE_QUARANTINED', 'This file failed the malware scan');
    }
    if (doc.scanStatus !== 'CLEAN') {
      throw new HttpError(409, 'SCAN_PENDING', 'This file has not been scanned yet');
    }
    await recordAudit(db, req, {
      actorId: user.id,
      action: 'DOWNLOAD',
      targetType: 'document',
      targetId: doc.id,
      result: 'SUCCESS',
    });
    const object = await storage.getStream(doc.storageKey);
    const ascii = doc.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
    );
    res.setHeader('Content-Length', String(object.contentLength ?? doc.sizeBytes));
    res.setHeader('Cache-Control', 'private, no-store');
    await pipeline(object.body, res);
  });

  return router;
}
