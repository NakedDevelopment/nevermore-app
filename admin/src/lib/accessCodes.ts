import { ID, Query } from 'appwrite';
import { tablesDB } from './appwrite';
import { showAppwriteError } from './notifications';

// Administrator-issued access codes: pilots, research, corporate/bulk
// licensing, promotions, complimentary access. Deliberately a separate
// Appwrite collection from the app's `invitations` (subscriber
// shared-subscription invites) — both are redeemed through the same
// "Enter Invitation Code" screen in the app, but tracked, configured, and
// reported on separately here for billing/reporting/partnership reasons.
const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';
const ACCESS_CODES_COLLECTION_ID = import.meta.env.VITE_APPWRITE_ACCESS_CODES_COLLECTION_ID || 'access_codes';
const ACCESS_CODE_REDEMPTIONS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_ACCESS_CODE_REDEMPTIONS_COLLECTION_ID || 'access_code_redemptions';

export interface AccessCode {
  $id: string;
  code: string;
  campaignName?: string;
  organizationName?: string;
  accessDurationDays: number; // 0 = access doesn't expire once granted
  maxRedemptions: number | null; // null = unlimited
  redemptionCount: number;
  startDate?: string;
  expiresAt?: string;
  isComplimentary: boolean;
  discountPercent?: number;
  notes?: string;
  status: 'active' | 'inactive';
  createdBy?: string;
  $createdAt: string;
  $updatedAt: string;
}

export interface AccessCodeRedemption {
  $id: string;
  codeId: string;
  code: string;
  userId: string;
  redeemedAt: string;
  accessExpiresAt?: string;
  status: 'active' | 'revoked';
}

export interface AccessCodeConfig {
  campaignName?: string;
  organizationName?: string;
  accessDurationDays: number;
  maxRedemptions: number | null; // null = unlimited (must be sent explicitly — omitting the field defaults to 1 single-use)
  startDate?: string;
  expiresAt?: string;
  isComplimentary: boolean;
  discountPercent?: number;
  notes?: string;
  status: 'active' | 'inactive';
  createdBy?: string;
}

// Unambiguous alphabet (no 0/O, 1/I/L) so a recipient can read a code off a
// screen or printout and type it correctly.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomSegment(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Builds a single "<PREFIX>-<segment>" style code, e.g. "AAC-7H4K92". */
export function generateCode(prefix: string, segmentLength = 6): string {
  const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'NM';
  return `${cleanPrefix}-${randomSegment(segmentLength)}`;
}

async function codeExists(code: string): Promise<boolean> {
  const response = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: ACCESS_CODES_COLLECTION_ID,
    queries: [Query.equal('code', code), Query.limit(1)],
  });
  return response.rows.length > 0;
}

async function generateUniqueCode(prefix: string, segmentLength: number): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode(prefix, segmentLength);
    if (!(await codeExists(code))) {
      return code;
    }
  }
  throw new Error(`Failed to generate a unique code with prefix "${prefix}". Please try again.`);
}

async function createAccessCodeRow(code: string, config: AccessCodeConfig): Promise<AccessCode> {
  const row = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: ACCESS_CODES_COLLECTION_ID,
    rowId: ID.unique(),
    data: {
      code,
      campaignName: config.campaignName || '',
      organizationName: config.organizationName || '',
      accessDurationDays: config.accessDurationDays,
      maxRedemptions: config.maxRedemptions,
      redemptionCount: 0,
      startDate: config.startDate,
      expiresAt: config.expiresAt,
      isComplimentary: config.isComplimentary,
      discountPercent: config.discountPercent,
      notes: config.notes || '',
      status: config.status,
      createdBy: config.createdBy || '',
    },
  });
  return row as unknown as AccessCode;
}

/**
 * Creates a batch of unique codes sharing one configuration — the common
 * case for a pilot/campaign ("generate 250 codes for Anne Arundel County").
 * For a single reusable code, call with `count: 1` and `maxRedemptions > 1`
 * on the config instead of generating many codes.
 *
 * Runs sequentially (not in parallel) so a large batch doesn't slam Appwrite
 * with a burst of concurrent writes; `onProgress` lets the UI show a counter
 * for batches large enough that the user would otherwise wonder if it hung.
 */
export async function createAccessCodeBatch(
  prefix: string,
  count: number,
  config: AccessCodeConfig,
  options?: { segmentLength?: number; onProgress?: (done: number, total: number) => void }
): Promise<AccessCode[]> {
  try {
    if (count < 1) {
      throw new Error('Number of codes must be at least 1.');
    }
    const segmentLength = options?.segmentLength ?? 6;
    const created: AccessCode[] = [];

    for (let i = 0; i < count; i++) {
      const code = await generateUniqueCode(prefix, segmentLength);
      created.push(await createAccessCodeRow(code, config));
      options?.onProgress?.(i + 1, count);
    }

    return created;
  } catch (error: unknown) {
    showAppwriteError(error);
    throw error;
  }
}

/** Creates one code with an explicit, admin-chosen string (e.g. "AAC-PILOT-2026"). */
export async function createNamedAccessCode(code: string, config: AccessCodeConfig): Promise<AccessCode> {
  try {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      throw new Error('Enter a code.');
    }
    if (await codeExists(normalized)) {
      throw new Error(`Code "${normalized}" already exists.`);
    }
    return await createAccessCodeRow(normalized, config);
  } catch (error: unknown) {
    showAppwriteError(error);
    throw error;
  }
}

const LIST_PAGE_SIZE = 100;
const LIST_HARD_CAP = 5000; // guards against a runaway loop; raise if a program genuinely exceeds this

/** Lists all access codes, newest first. Paginates internally past Appwrite's per-request cap. */
export async function listAccessCodes(): Promise<AccessCode[]> {
  const all: AccessCode[] = [];
  let cursor: string | undefined;

  while (all.length < LIST_HARD_CAP) {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(LIST_PAGE_SIZE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: ACCESS_CODES_COLLECTION_ID,
      queries,
    });

    const rows = response.rows as unknown as AccessCode[];
    all.push(...rows);

    if (rows.length < LIST_PAGE_SIZE) {
      break;
    }
    cursor = rows[rows.length - 1].$id;
  }

  return all;
}

export async function setAccessCodeStatus(codeId: string, status: 'active' | 'inactive'): Promise<void> {
  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: ACCESS_CODES_COLLECTION_ID,
      rowId: codeId,
      data: { status },
    });
  } catch (error: unknown) {
    showAppwriteError(error);
    throw error;
  }
}

export async function updateAccessCode(
  codeId: string,
  patch: Partial<Pick<AccessCodeConfig, 'expiresAt' | 'maxRedemptions' | 'notes' | 'accessDurationDays'>>
): Promise<void> {
  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: ACCESS_CODES_COLLECTION_ID,
      rowId: codeId,
      data: patch,
    });
  } catch (error: unknown) {
    showAppwriteError(error);
    throw error;
  }
}

export interface CampaignSummary {
  campaignName: string;
  codesIssued: number;
  codesRedeemed: number; // sum of redemptionCount across the campaign's codes
  totalRedemptionCapacity: number | null; // sum of maxRedemptions; null if any code in the campaign is unlimited
  redemptionRate: number | null; // codesRedeemed / totalRedemptionCapacity; null when capacity is unlimited or 0
}

/** Aggregates issued/redeemed/remaining per campaign — item 17's pilot-tracking view. */
export function summarizeByCampaign(codes: AccessCode[]): CampaignSummary[] {
  const byCampaign = new Map<string, AccessCode[]>();
  for (const code of codes) {
    const key = code.campaignName?.trim() || 'Uncategorized';
    if (!byCampaign.has(key)) {
      byCampaign.set(key, []);
    }
    byCampaign.get(key)!.push(code);
  }

  return Array.from(byCampaign.entries()).map(([campaignName, campaignCodes]) => {
    const codesRedeemed = campaignCodes.reduce((sum, c) => sum + c.redemptionCount, 0);
    const hasUnlimitedCode = campaignCodes.some((c) => c.maxRedemptions === null);
    const totalRedemptionCapacity = hasUnlimitedCode
      ? null
      : campaignCodes.reduce((sum, c) => sum + (c.maxRedemptions as number), 0);
    return {
      campaignName,
      codesIssued: campaignCodes.length,
      codesRedeemed,
      totalRedemptionCapacity,
      redemptionRate: totalRedemptionCapacity && totalRedemptionCapacity > 0 ? codesRedeemed / totalRedemptionCapacity : null,
    };
  });
}

/** Builds a downloadable CSV of the given codes. */
export function accessCodesToCsv(codes: AccessCode[]): string {
  const headers = [
    'code',
    'campaignName',
    'organizationName',
    'status',
    'accessDurationDays',
    'maxRedemptions',
    'redemptionCount',
    'startDate',
    'expiresAt',
    'isComplimentary',
    'discountPercent',
    'notes',
    'createdAt',
  ];

  const escape = (value: unknown): string => {
    const str = value === undefined || value === null ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const rows = codes.map((c) =>
    [
      c.code,
      c.campaignName,
      c.organizationName,
      c.status,
      c.accessDurationDays,
      c.maxRedemptions === null ? 'unlimited' : c.maxRedemptions,
      c.redemptionCount,
      c.startDate,
      c.expiresAt,
      c.isComplimentary,
      c.discountPercent,
      c.notes,
      c.$createdAt,
    ]
      .map(escape)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export async function listRedemptionsForCode(codeId: string): Promise<AccessCodeRedemption[]> {
  const response = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: ACCESS_CODE_REDEMPTIONS_COLLECTION_ID,
    queries: [Query.equal('codeId', codeId), Query.orderDesc('redeemedAt')],
  });
  return response.rows as unknown as AccessCodeRedemption[];
}
