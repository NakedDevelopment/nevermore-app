#!/usr/bin/env node
/**
 * One-time backfill: remux every MP4-family audio file (m4a/mp4/m4b/mov)
 * already sitting in Appwrite Storage so its `moov` atom is at the front.
 *
 * Context: admin/src/lib/audioFastStart.ts fixes this at upload time going
 * forward, but everything uploaded before that change is still trailing-moov
 * and will hit the mobile app's "restarts mid-track" bug on streamed
 * playback. This script finds every audio URL referenced by a `content` row
 * (files, recoveryQuestionFiles, supportQuestionFiles, mainContentRecoveryURL,
 * mainContentSupportURL), downloads it, remuxes with the same
 * `-c copy -movflags +faststart` used client-side, and — if the bytes
 * actually changed — replaces the file IN PLACE (delete + recreate with the
 * same fileId) so every stored URL keeps working unmodified.
 *
 * Usage:
 *   APPWRITE_API_KEY=... node scripts/backfill-audio-faststart.mjs [--dry-run] [--content-id=<id>]
 *
 * --dry-run       Report what would be remuxed/replaced without touching Storage.
 * --content-id    Only process one content row (repeatable).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '690e3baa001394c27759';
const databaseId = process.env.APPWRITE_DATABASE_ID || '6912007500389741ee0f';
const apiKey = process.env.APPWRITE_API_KEY;
const contentCollectionId = process.env.APPWRITE_CONTENT_COLLECTION_ID || 'content';

if (!apiKey) {
  throw new Error('APPWRITE_API_KEY is required.');
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const contentIdFilter = args
  .filter((a) => a.startsWith('--content-id='))
  .map((a) => a.slice('--content-id='.length));

const MP4_FAMILY_EXTENSIONS = new Set(['m4a', 'mp4', 'm4b', 'mov']);
const MP4_FAMILY_MIME_TYPES = new Set([
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'video/mp4',
  'video/quicktime',
]);

const AUDIO_FIELDS_ARRAY = ['files', 'recoveryQuestionFiles', 'supportQuestionFiles'];
const AUDIO_FIELDS_SINGLE = ['mainContentRecoveryURL', 'mainContentSupportURL'];

function authHeaders(extra = {}) {
  return {
    'X-Appwrite-Project': projectId,
    'X-Appwrite-Key': apiKey,
    ...extra,
  };
}

async function request(pathname, options = {}) {
  const response = await fetch(`${endpoint}${pathname}`, {
    ...options,
    headers: authHeaders(options.headers),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${pathname} -> ${response.status}: ${text}`);
  }
  return response;
}

function extractFileInfoFromUrl(url) {
  const match = String(url).match(/\/buckets\/([^/]+)\/files\/([^/]+)/);
  if (!match) return null;
  return { bucketId: match[1], fileId: match[2] };
}

function getExtension(fileName) {
  return (fileName.split('.').pop() || '').toLowerCase();
}

function isMp4FamilyAudioFile(name, mimeType) {
  return MP4_FAMILY_EXTENSIONS.has(getExtension(name)) || MP4_FAMILY_MIME_TYPES.has(mimeType);
}

async function listAllContentRows() {
  if (contentIdFilter.length > 0) {
    const rows = [];
    for (const id of contentIdFilter) {
      const res = await request(
        `/tablesdb/${databaseId}/tables/${contentCollectionId}/rows/${id}`
      );
      rows.push(await res.json());
    }
    return rows;
  }

  const rows = [];
  let lastId = null;
  for (;;) {
    const queries = [encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] }))];
    if (lastId) {
      queries.push(encodeURIComponent(JSON.stringify({ method: 'cursorAfter', values: [lastId] })));
    }
    const qs = queries.map((q) => `queries[]=${q}`).join('&');
    const res = await request(`/tablesdb/${databaseId}/tables/${contentCollectionId}/rows?${qs}`);
    const body = await res.json();
    rows.push(...body.rows);
    if (body.rows.length < 100) break;
    lastId = body.rows[body.rows.length - 1].$id;
  }
  return rows;
}

function collectAudioUrls(row) {
  const urls = new Set();
  for (const field of AUDIO_FIELDS_ARRAY) {
    for (const url of row[field] || []) {
      if (url) urls.add(url);
    }
  }
  for (const field of AUDIO_FIELDS_SINGLE) {
    if (row[field]) urls.add(row[field]);
  }
  return [...urls];
}

async function getFileMetadata(bucketId, fileId) {
  const res = await request(`/storage/buckets/${bucketId}/files/${fileId}`);
  return res.json();
}

async function downloadFile(bucketId, fileId) {
  const res = await request(`/storage/buckets/${bucketId}/files/${fileId}/view`);
  return Buffer.from(await res.arrayBuffer());
}

async function remux(bytes, ext) {
  const dir = await mkdtemp(path.join(tmpdir(), 'faststart-'));
  const inPath = path.join(dir, `in.${ext}`);
  const outPath = path.join(dir, `out.${ext}`);
  try {
    await writeFile(inPath, bytes);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inPath,
      '-map', '0',
      '-c', 'copy',
      '-movflags', '+faststart',
      outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`Fetching content rows${contentIdFilter.length ? ` (${contentIdFilter.join(', ')})` : ''}...`);
  const rows = await listAllContentRows();
  console.log(`Found ${rows.length} content row(s).`);

  const seenFileIds = new Set();
  let scanned = 0;
  let fixed = 0;
  let alreadyOk = 0;
  let skippedNonAudio = 0;
  let failed = 0;

  for (const row of rows) {
    const urls = collectAudioUrls(row);
    for (const url of urls) {
      const info = extractFileInfoFromUrl(url);
      if (!info) continue;
      const key = `${info.bucketId}/${info.fileId}`;
      if (seenFileIds.has(key)) continue;
      seenFileIds.add(key);
      scanned++;

      let metadata;
      try {
        metadata = await getFileMetadata(info.bucketId, info.fileId);
      } catch (error) {
        console.error(`[${row.$id}] failed to read metadata for ${key}: ${error.message}`);
        failed++;
        continue;
      }

      if (!isMp4FamilyAudioFile(metadata.name, metadata.mimeType)) {
        skippedNonAudio++;
        continue;
      }

      const ext = getExtension(metadata.name) || 'm4a';
      try {
        const original = await downloadFile(info.bucketId, info.fileId);
        const remuxed = await remux(original, ext);

        if (Buffer.compare(original, remuxed) === 0) {
          console.log(`[${row.$id}] ${metadata.name} (${key}) already faststart, skipping.`);
          alreadyOk++;
          continue;
        }

        if (dryRun) {
          console.log(`[${row.$id}] ${metadata.name} (${key}) would be fixed (${original.length} -> ${remuxed.length} bytes).`);
          fixed++;
          continue;
        }

        await replaceFileInPlace(info.bucketId, info.fileId, metadata, original, remuxed);
        console.log(`[${row.$id}] ${metadata.name} (${key}) fixed in place.`);
        fixed++;
      } catch (error) {
        console.error(`[${row.$id}] failed to fix ${metadata.name} (${key}): ${error.message}`);
        failed++;
      }
    }
  }

  console.log('\nDone.');
  console.log(`  scanned audio files: ${scanned}`);
  console.log(`  ${dryRun ? 'would fix' : 'fixed'}: ${fixed}`);
  console.log(`  already faststart: ${alreadyOk}`);
  console.log(`  skipped (not mp4-family audio): ${skippedNonAudio}`);
  console.log(`  failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function replaceFileInPlace(bucketId, fileId, metadata, originalBytes, remuxedBytes) {
  await request(`/storage/buckets/${bucketId}/files/${fileId}`, { method: 'DELETE' });

  const form = new FormData();
  form.append('fileId', fileId);
  form.append('file', new Blob([remuxedBytes], { type: metadata.mimeType }), metadata.name);
  for (const permission of metadata.$permissions || []) {
    form.append('permissions[]', permission);
  }

  try {
    await request(`/storage/buckets/${bucketId}/files`, { method: 'POST', body: form });
  } catch (error) {
    console.error(`  recreate failed after delete, restoring original bytes for ${fileId}...`);
    const restoreForm = new FormData();
    restoreForm.append('fileId', fileId);
    restoreForm.append('file', new Blob([originalBytes], { type: metadata.mimeType }), metadata.name);
    for (const permission of metadata.$permissions || []) {
      restoreForm.append('permissions[]', permission);
    }
    await request(`/storage/buckets/${bucketId}/files`, { method: 'POST', body: restoreForm });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
