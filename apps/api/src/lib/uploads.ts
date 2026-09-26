import { createHash } from 'node:crypto';
import { PassThrough, Transform, type Readable } from 'node:stream';
import {
  ALLOWED_UPLOAD_TYPES,
  FILENAME_MAX_LENGTH,
  TEXT_MIME_TYPES,
  type AllowedExtension,
} from '@ecp/shared';
import { fileTypeFromBuffer } from 'file-type';

// Enough bytes to identify Office documents, whose signature sits inside a zip
// directory rather than at offset zero.
export const SAMPLE_BYTES = 64 * 1024;

// Strips directories, control characters and anything a shell or a browser could
// misread. The result is display-only: storage keys are random and never use it.
export function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFC')
    .replace(/\p{Cc}/gu, '')
    .replace(/[^\p{L}\p{N} ._()-]/gu, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+|[ .]+$/g, '');
  const dot = cleaned.lastIndexOf('.');
  const stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned) || 'file';
  const ext = dot > 0 ? cleaned.slice(dot).toLowerCase() : '';
  const room = Math.max(1, FILENAME_MAX_LENGTH - ext.length);
  return stem.slice(0, room) + ext;
}

export function extensionOf(filename: string): AllowedExtension | undefined {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  const ext = match?.[1]?.toLowerCase();
  return ext && ext in ALLOWED_UPLOAD_TYPES ? (ext as AllowedExtension) : undefined;
}

export type TypeCheck =
  | { ok: true; mimeType: string }
  | { ok: false; code: 'TYPE_NOT_ALLOWED' | 'TYPE_MISMATCH'; detected: string | undefined };

function looksLikeText(sample: Uint8Array): boolean {
  if (sample.length === 0) return true;
  for (const byte of sample) {
    // NUL or C0 controls other than tab, LF, CR mean binary content.
    if (byte === 0 || (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)) {
      return false;
    }
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

// Requirement B5: the extension is a claim; the bytes are the evidence. A file is
// accepted only when both agree with the allow-list. The stored MIME type is what
// the bytes proved, never what the client declared.
export async function checkFileType(sample: Uint8Array, filename: string): Promise<TypeCheck> {
  const ext = extensionOf(filename);
  if (!ext) return { ok: false, code: 'TYPE_NOT_ALLOWED', detected: undefined };
  const expected = ALLOWED_UPLOAD_TYPES[ext];
  const detected = await fileTypeFromBuffer(sample);

  if (TEXT_MIME_TYPES.has(expected)) {
    // Text has no magic bytes: it must look like text and must not carry a binary signature.
    if (detected || !looksLikeText(sample)) {
      return { ok: false, code: 'TYPE_MISMATCH', detected: detected?.mime };
    }
    return { ok: true, mimeType: expected };
  }
  if (detected?.mime !== expected) {
    return { ok: false, code: 'TYPE_MISMATCH', detected: detected?.mime };
  }
  return { ok: true, mimeType: expected };
}

export interface Peeked {
  sample: Uint8Array;
  stream: Readable;
}

// Reads the first `bytes` of a stream for inspection, then hands back a stream that
// replays them followed by the rest, so nothing is read from the source twice.
export function peekStream(source: Readable, bytes: number): Promise<Peeked> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const out = new PassThrough();

    const cleanup = () => {
      source.off('data', onData);
      source.off('end', onEnd);
      source.off('error', onError);
    };
    const finish = (ended: boolean) => {
      cleanup();
      const sample = Buffer.concat(chunks);
      for (const chunk of chunks) out.write(chunk);
      if (ended) out.end();
      else source.pipe(out);
      resolve({ sample: sample.subarray(0, bytes), stream: out });
    };
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= bytes) {
        source.pause();
        finish(false);
      }
    };
    const onEnd = () => finish(true);
    const onError = (err: Error) => {
      cleanup();
      out.destroy(err);
      reject(err);
    };

    source.on('data', onData);
    source.on('end', onEnd);
    source.on('error', onError);
  });
}

export interface Digest {
  stream: Transform;
  result(): { sha256: string; sizeBytes: number };
}

// Pass-through that hashes and counts while the bytes flow to storage.
export function digestStream(): Digest {
  const hash = createHash('sha256');
  let sizeBytes = 0;
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      sizeBytes += chunk.length;
      callback(null, chunk);
    },
  });
  return { stream, result: () => ({ sha256: hash.digest('hex'), sizeBytes }) };
}
