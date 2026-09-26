import type { DocumentMetadata, ListDocumentsQuery } from '@ecp/shared';
import type { Db } from '../db.js';
import type { Prisma } from '../generated/prisma/client.js';

// Every function here takes ownerId and puts it in the WHERE clause. Routes never
// query documents directly, so a forgotten check in one handler cannot leak a
// document (architecture.md section 7). Soft-deleted rows are invisible everywhere.

export const documentInclude = {
  folder: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.DocumentInclude;

type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

export function toMetadata(doc: DocumentRow): DocumentMetadata {
  return {
    id: doc.id,
    originalName: doc.originalName,
    sizeBytes: doc.sizeBytes,
    mimeType: doc.mimeType,
    checksumSha256: doc.checksumSha256,
    scanStatus: doc.scanStatus,
    folder: doc.folder,
    tags: doc.tags.map((t) => t.tag.name).sort(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function owned(ownerId: string, id: string): Prisma.DocumentWhereInput {
  return { id, ownerId, deletedAt: null };
}

export async function findOwnedDocument(db: Db, ownerId: string, id: string) {
  return db.document.findFirst({ where: owned(ownerId, id), include: documentInclude });
}

export async function listOwnedDocuments(db: Db, ownerId: string, query: ListDocumentsQuery) {
  const where: Prisma.DocumentWhereInput = { ownerId, deletedAt: null };
  if (query.q) where.originalName = { contains: query.q, mode: 'insensitive' };
  if (query.folderId === 'root') where.folderId = null;
  else if (query.folderId) where.folderId = query.folderId;
  if (query.tag) where.tags = { some: { tag: { name: query.tag, ownerId } } };
  if (query.scanStatus) where.scanStatus = query.scanStatus;

  const [rows, total] = await db.$transaction([
    db.document.findMany({
      where,
      include: documentInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.document.count({ where }),
  ]);
  return { items: rows.map(toMetadata), total };
}

export async function ownsFolder(db: Db, ownerId: string, folderId: string): Promise<boolean> {
  const folder = await db.folder.findFirst({
    where: { id: folderId, ownerId },
    select: { id: true },
  });
  return folder !== null;
}

// Tags are created on demand and scoped to the owner; two users can each have "tax".
export async function setDocumentTags(
  tx: Prisma.TransactionClient,
  ownerId: string,
  documentId: string,
  names: string[],
): Promise<void> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const tags = await Promise.all(
    unique.map((name) =>
      tx.tag.upsert({
        where: { ownerId_name: { ownerId, name } },
        create: { ownerId, name },
        update: {},
        select: { id: true },
      }),
    ),
  );
  await tx.documentTag.deleteMany({ where: { documentId } });
  if (tags.length > 0) {
    await tx.documentTag.createMany({ data: tags.map((t) => ({ documentId, tagId: t.id })) });
  }
}

export async function softDeleteOwnedDocument(db: Db, ownerId: string, id: string) {
  const result = await db.document.updateMany({
    where: owned(ownerId, id),
    data: { deletedAt: new Date() },
  });
  return result.count === 1;
}
