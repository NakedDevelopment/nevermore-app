const endpoint = process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '690e3baa001394c27759';
const databaseId = process.env.APPWRITE_DATABASE_ID || '6912007500389741ee0f';
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  throw new Error('APPWRITE_API_KEY is required.');
}

const tables = {
  invitations: process.env.APPWRITE_INVITATIONS_COLLECTION_ID || 'invitations',
  userProfiles: process.env.APPWRITE_USER_PROFILES_COLLECTION_ID || 'user_profiles',
};

const required = {
  invitations: {
    string: [{ key: 'inviteeId', size: 64 }],
    datetime: [
      { key: 'acceptedAt' },
      { key: 'revokedAt' },
      { key: 'upgradedAt' },
    ],
    statusValues: ['pending', 'accepted', 'expired', 'revoked', 'upgraded'],
  },
  userProfiles: {
    enum: [
      {
        key: 'subscription_status',
        elements: ['active', 'inactive'],
      },
    ],
    datetime: [{ key: 'subscription_updated_at' }],
  },
};

async function request(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Response-Format': '1.9.5',
      'X-Appwrite-Project': projectId,
      'X-Appwrite-Key': apiKey,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = body?.message || `${response.status} ${response.statusText}`;
    throw new Error(`${options.method || 'GET'} ${path} failed: ${message}`);
  }

  return body;
}

async function listColumns(tableId) {
  const body = await request(`/tablesdb/${databaseId}/tables/${tableId}/columns`);
  return body?.columns || body?.attributes || [];
}

function columnByKey(columns, key) {
  return columns.find((column) => column.key === key);
}

async function createStringColumn(tableId, key, size) {
  await request(`/tablesdb/${databaseId}/tables/${tableId}/columns/string`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      size,
      required: false,
      array: false,
      encrypt: false,
    }),
  });
}

async function createDatetimeColumn(tableId, key) {
  await request(`/tablesdb/${databaseId}/tables/${tableId}/columns/datetime`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      required: false,
      array: false,
    }),
  });
}

async function createEnumColumn(tableId, key, elements) {
  await request(`/tablesdb/${databaseId}/tables/${tableId}/columns/enum`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      elements,
      required: false,
      array: false,
    }),
  });
}

async function patchEnumColumn(tableId, key, elements, column) {
  await request(`/tablesdb/${databaseId}/tables/${tableId}/columns/enum/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({
      elements,
      required: Boolean(column.required),
      default: column.default ?? '',
      newKey: key,
    }),
  });
}

function getEnumElements(column) {
  return column.elements || column.options || [];
}

async function ensureInvitationColumns() {
  const tableId = tables.invitations;
  let columns = await listColumns(tableId);

  for (const { key, size } of required.invitations.string) {
    if (!columnByKey(columns, key)) {
      console.log(`Creating ${tableId}.${key}`);
      await createStringColumn(tableId, key, size);
      columns = await listColumns(tableId);
    } else {
      console.log(`Exists ${tableId}.${key}`);
    }
  }

  for (const { key } of required.invitations.datetime) {
    if (!columnByKey(columns, key)) {
      console.log(`Creating ${tableId}.${key}`);
      await createDatetimeColumn(tableId, key);
      columns = await listColumns(tableId);
    } else {
      console.log(`Exists ${tableId}.${key}`);
    }
  }

  const statusColumn = columnByKey(columns, 'status');
  if (!statusColumn) {
    console.log(`Creating ${tableId}.status`);
    await createEnumColumn(tableId, 'status', required.invitations.statusValues);
    return;
  }

  if (statusColumn.type !== 'enum') {
    console.log(`${tableId}.status is ${statusColumn.type}; leaving as-is because it is not an enum column.`);
    return;
  }

  const currentElements = getEnumElements(statusColumn);
  const merged = Array.from(new Set([...currentElements, ...required.invitations.statusValues]));
  const missing = required.invitations.statusValues.filter((value) => !currentElements.includes(value));

  if (missing.length > 0) {
    console.log(`Updating ${tableId}.status values: ${missing.join(', ')}`);
    await patchEnumColumn(tableId, 'status', merged, statusColumn);
  } else {
    console.log(`Exists ${tableId}.status values`);
  }
}

async function ensureUserProfileColumns() {
  const tableId = tables.userProfiles;
  let columns = await listColumns(tableId);

  for (const { key, elements } of required.userProfiles.enum) {
    const column = columnByKey(columns, key);
    if (!column) {
      console.log(`Creating ${tableId}.${key}`);
      await createEnumColumn(tableId, key, elements);
      columns = await listColumns(tableId);
      continue;
    }

    if (column.type !== 'enum') {
      console.log(`${tableId}.${key} is ${column.type}; leaving as-is because it is not an enum column.`);
      continue;
    }

    const currentElements = getEnumElements(column);
    const merged = Array.from(new Set([...currentElements, ...elements]));
    const missing = elements.filter((value) => !currentElements.includes(value));

    if (missing.length > 0) {
      console.log(`Updating ${tableId}.${key} values: ${missing.join(', ')}`);
      await patchEnumColumn(tableId, key, merged, column);
    } else {
      console.log(`Exists ${tableId}.${key} values`);
    }
  }

  columns = await listColumns(tableId);
  for (const { key } of required.userProfiles.datetime) {
    if (!columnByKey(columns, key)) {
      console.log(`Creating ${tableId}.${key}`);
      await createDatetimeColumn(tableId, key);
      columns = await listColumns(tableId);
    } else {
      console.log(`Exists ${tableId}.${key}`);
    }
  }
}

async function verify() {
  const invitationColumns = await listColumns(tables.invitations);
  const profileColumns = await listColumns(tables.userProfiles);
  const invitationKeys = new Set(invitationColumns.map((column) => column.key));
  const profileKeys = new Set(profileColumns.map((column) => column.key));

  const missing = [
    ...required.invitations.string.map(({ key }) => [tables.invitations, key, invitationKeys.has(key)]),
    ...required.invitations.datetime.map(({ key }) => [tables.invitations, key, invitationKeys.has(key)]),
    ...required.userProfiles.enum.map(({ key }) => [tables.userProfiles, key, profileKeys.has(key)]),
    ...required.userProfiles.datetime.map(({ key }) => [tables.userProfiles, key, profileKeys.has(key)]),
  ].filter(([, , exists]) => !exists);

  if (missing.length > 0) {
    throw new Error(`Missing columns after migration: ${missing.map(([table, key]) => `${table}.${key}`).join(', ')}`);
  }

  console.log('Verified shared subscription schema columns.');
}

await ensureInvitationColumns();
await ensureUserProfileColumns();
await verify();
