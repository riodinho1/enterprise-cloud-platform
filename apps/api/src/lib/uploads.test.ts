import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, expect, it } from 'vitest';
import { PDF_BYTES, PNG_BYTES, TEXT_BYTES } from '../test/helpers.js';
import { checkFileType, digestStream, peekStream, sanitizeFilename } from './uploads.js';

describe('sanitizeFilename', () => {
  it('strips paths, control characters and shell-hostile characters', () => {
    expect(sanitizeFilename('C:\\Users\\x\\..\\report.PDF')).toBe('report.pdf');
    expect(sanitizeFilename('/etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('a<b>|c?"d*.txt')).toBe('a_b__c__d_.txt');
    expect(sanitizeFilename('tab\there\u0000.txt')).toBe('tabhere.txt');
    expect(sanitizeFilename('  ..hidden.. ')).toBe('hidden');
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('.pdf')).toBe('pdf'); // leading dots go: no hidden files
  });

  it('keeps unicode letters and limits the length while preserving the extension', () => {
    expect(sanitizeFilename('Résumé (final).pdf')).toBe('Résumé (final).pdf');
    const long = sanitizeFilename(`${'a'.repeat(300)}.docx`);
    expect(long.length).toBeLessThanOrEqual(200);
    expect(long.endsWith('.docx')).toBe(true);
  });
});

describe('checkFileType', () => {
  it('accepts content that matches its extension', async () => {
    expect(await checkFileType(PDF_BYTES, 'a.pdf')).toEqual({
      ok: true,
      mimeType: 'application/pdf',
    });
    expect(await checkFileType(PNG_BYTES, 'a.png')).toEqual({ ok: true, mimeType: 'image/png' });
    expect(await checkFileType(TEXT_BYTES, 'a.md')).toEqual({
      ok: true,
      mimeType: 'text/markdown',
    });
    expect(await checkFileType(new Uint8Array(0), 'empty.txt')).toEqual({
      ok: true,
      mimeType: 'text/plain',
    });
  });

  it('rejects unknown extensions and mismatches', async () => {
    expect(await checkFileType(PDF_BYTES, 'a.exe')).toMatchObject({
      ok: false,
      code: 'TYPE_NOT_ALLOWED',
    });
    expect(await checkFileType(PDF_BYTES, 'noext')).toMatchObject({
      ok: false,
      code: 'TYPE_NOT_ALLOWED',
    });
    expect(await checkFileType(PNG_BYTES, 'a.pdf')).toEqual({
      ok: false,
      code: 'TYPE_MISMATCH',
      detected: 'image/png',
    });
    expect(await checkFileType(PDF_BYTES, 'a.txt')).toMatchObject({
      ok: false,
      code: 'TYPE_MISMATCH',
    });
    expect(await checkFileType(TEXT_BYTES, 'a.pdf')).toEqual({
      ok: false,
      code: 'TYPE_MISMATCH',
      detected: undefined,
    });
    expect(await checkFileType(Buffer.from([0xff, 0xfe, 0x00, 0x41]), 'a.txt')).toMatchObject({
      ok: false,
    });
  });
});

describe('peekStream and digestStream', () => {
  async function roundTrip(bytes: Buffer, chunkSize: number, peek: number) {
    const source = Readable.from(
      (function* () {
        for (let i = 0; i < bytes.length; i += chunkSize) yield bytes.subarray(i, i + chunkSize);
      })(),
    );
    const { sample, stream } = await peekStream(source, peek);
    const digest = digestStream();
    const out: Buffer[] = [];
    digest.stream.on('data', (c: Buffer) => out.push(c));
    await pipeline(stream, digest.stream);
    return { sample, out: Buffer.concat(out), digest: digest.result() };
  }

  it('replays the peeked bytes and the rest without loss, whatever the chunking', async () => {
    const bytes = randomBytes(200_000);
    for (const [chunk, peek] of [
      [7, 64],
      [65_536, 64 * 1024],
      [1_000_000, 4096],
    ]) {
      const r = await roundTrip(bytes, chunk as number, peek as number);
      expect(r.sample.length).toBe(Math.min(peek as number, bytes.length));
      expect(Buffer.from(r.sample).equals(bytes.subarray(0, r.sample.length))).toBe(true);
      expect(r.out.equals(bytes)).toBe(true);
      expect(r.digest.sizeBytes).toBe(bytes.length);
    }
  });

  it('handles a stream shorter than the sample', async () => {
    const r = await roundTrip(Buffer.from('tiny'), 2, 1024);
    expect(r.sample.toString()).toBe('tiny');
    expect(r.out.toString()).toBe('tiny');
    expect(r.digest.sha256).toHaveLength(64);
  });
});
