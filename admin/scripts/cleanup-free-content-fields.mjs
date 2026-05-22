import { Client, TablesDB, Query } from 'appwrite';

/**
 * One-time cleanup before removing Appwrite schema fields:
 * - category.freeTemptationContentId -> null
 * - category.isFreeCategory -> null
 * - content.isFree -> null
 *
 * Requires a server API key.
 *
 * Usage (example):
 * APPWRITE_ENDPOINT="https://cloud.appwrite.io/v1" \
 * APPWRITE_PROJECT_ID="..." \
 * APPWRITE_API_KEY="..." \
 * APPWRITE_DATABASE_ID="..." \
 * APPWRITE_CATEGORY_COLLECTION_ID="category" \
 * APPWRITE_CONTENT_COLLECTION_ID="content" \
 * node scripts/cleanup-free-content-fields.mjs
 */

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID,
  APPWRITE_CATEGORY_COLLECTION_ID = 'category',
  APPWRITE_CONTENT_COLLECTION_ID = 'content',
} = process.env;

function requireEnv(name) {
  if (!process.env[name] || String(process.env[name]).trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
}

requireEnv('APPWRITE_ENDPOINT');
requireEnv('APPWRITE_PROJECT_ID');
requireEnv('APPWRITE_API_KEY');
requireEnv('APPWRITE_DATABASE_ID');

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);

async function* listAllRows({ tableId, pageSize = 100 }) {
  let offset = 0;
  while (true) {
    const res = await tablesDB.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId,
      queries: [Query.limit(pageSize), Query.offset(offset)],
    });
    const rows = res.rows ?? [];
    if (rows.length === 0) return;
    for (const row of rows) yield row;
    offset += rows.length;
    if (offset >= (res.total ?? 0)) return;
  }
}

async function cleanupCategories() {
  let updated = 0;
  for await (const row of listAllRows({ tableId: APPWRITE_CATEGORY_COLLECTION_ID })) {
    const hasFreeTemptation = row.freeTemptationContentId != null && String(row.freeTemptationContentId).trim() !== '';
    const hasIsFreeCategory = row.isFreeCategory != null;
    if (!hasFreeTemptation && !hasIsFreeCategory) continue;

    await tablesDB.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_CATEGORY_COLLECTION_ID,
      rowId: row.$id,
      data: {
        freeTemptationContentId: null,
        isFreeCategory: null,
      },
    });
    updated++;
    if (updated % 25 === 0) {
      console.log(`[categories] cleaned ${updated}`);
    }
  }
  console.log(`[categories] cleaned ${updated} rows`);
}

async function cleanupContent() {
  let updated = 0;
  for await (const row of listAllRows({ tableId: APPWRITE_CONTENT_COLLECTION_ID })) {
    const hasIsFree = row.isFree != null;
    if (!hasIsFree) continue;
    await tablesDB.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_CONTENT_COLLECTION_ID,
      rowId: row.$id,
      data: { isFree: null },
    });
    updated++;
    if (updated % 25 === 0) {
      console.log(`[content] cleaned ${updated}`);
    }
  }
  console.log(`[content] cleaned ${updated} rows`);
}

async function main() {
  console.log('Starting cleanup...');
  await cleanupCategories();
  await cleanupContent();
  console.log('Cleanup finished.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

