import { z } from 'zod';

// The upload allow-list, shared so the browser can pre-filter and the API can enforce.
// The key is the file extension; the value is the MIME type the content must prove
// to have (by magic bytes for binary types, by being plain UTF-8 text for text types).
export const ALLOWED_UPLOAD_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
} as const;

export type AllowedExtension = keyof typeof ALLOWED_UPLOAD_TYPES;
export const ALLOWED_UPLOAD_EXTENSIONS = Object.keys(ALLOWED_UPLOAD_TYPES) as AllowedExtension[];
export const TEXT_MIME_TYPES: ReadonlySet<string> = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
]);

export const SCAN_STATUSES = ['PENDING_SCAN', 'CLEAN', 'QUARANTINED', 'FAILED'] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const TAG_MAX_LENGTH = 40;
export const TAGS_PER_DOCUMENT = 20;
export const FILENAME_MAX_LENGTH = 200;

const uuid = z.string().uuid();
const tagName = z.string().trim().min(1).max(TAG_MAX_LENGTH);

export const createFolderSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const updateFolderSchema = createFolderSchema;

export const updateDocumentSchema = z
  .object({
    originalName: z.string().trim().min(1).max(FILENAME_MAX_LENGTH),
    folderId: uuid.nullable(),
    tags: z.array(tagName).max(TAGS_PER_DOCUMENT),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'nothing to update' });

export const listDocumentsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  folderId: z.union([uuid, z.literal('root')]).optional(),
  tag: tagName.optional(),
  scanStatus: z.enum(SCAN_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

export interface FolderInfo {
  id: string;
  name: string;
  createdAt: string;
}

export interface TagInfo {
  id: string;
  name: string;
  documentCount: number;
}

export interface DocumentMetadata {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  checksumSha256: string;
  scanStatus: ScanStatus;
  folder: { id: string; name: string } | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  items: DocumentMetadata[];
  page: number;
  pageSize: number;
  total: number;
}
