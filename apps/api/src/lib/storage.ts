import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { Config } from '../config.js';

export type StorageConfig = Pick<
  Config,
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_BUCKET'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
  | 'S3_FORCE_PATH_STYLE'
>;

export interface StoredObject {
  body: Readable;
  contentLength: number | undefined;
}

// The only thing the rest of the API knows about storage. Swapping SeaweedFS for
// Amazon S3 is a configuration change, not a code change (SIMULATED label).
export interface Storage {
  readonly bucket: string;
  putStream(key: string, body: Readable, contentType: string): Promise<void>;
  getStream(key: string): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  ensureBucket(): Promise<void>;
  ping(timeoutMs?: number): Promise<boolean>;
  emptyBucket(): Promise<void>;
}

const PART_SIZE = 5 * 1024 * 1024;

function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NotFound' || e.name === 'NoSuchBucket' || e.$metadata?.httpStatusCode === 404;
}

export function createStorage(config: StorageConfig): Storage {
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
    // Newer SDKs add CRC32 trailers by default; several S3-compatible stores reject them.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Bucket = config.S3_BUCKET;

  return {
    bucket: Bucket,

    async putStream(key, body, contentType) {
      // Multipart upload driven by the stream: nothing is buffered in full, and a
      // failure removes the parts already sent.
      const upload = new Upload({
        client,
        params: { Bucket, Key: key, Body: body, ContentType: contentType },
        partSize: PART_SIZE,
        queueSize: 2,
        leavePartsOnError: false,
      });
      await upload.done();
    },

    async getStream(key) {
      const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!res.Body) throw new Error(`empty body for ${key}`);
      return { body: res.Body as Readable, contentLength: res.ContentLength };
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    async ensureBucket() {
      try {
        await client.send(new HeadBucketCommand({ Bucket }));
      } catch (err) {
        if (!isNotFound(err)) throw err;
        await client.send(new CreateBucketCommand({ Bucket }));
      }
    },

    async ping(timeoutMs = 2000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timer.unref();
      try {
        await client.send(new HeadBucketCommand({ Bucket }), { abortSignal: controller.signal });
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },

    // Test support only: removes every object so a run starts from nothing.
    async emptyBucket() {
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket, ContinuationToken: token }),
        );
        const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (keys.length > 0) {
          await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys } }));
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    },
  };
}
