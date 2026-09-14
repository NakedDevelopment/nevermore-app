import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Button } from '../components/Button';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import CloseIcon from '../assets/icons/close';
import { showSuccess, showWarning } from '../lib/notifications';
import {
  createAccessCodeBatch,
  createNamedAccessCode,
  listAccessCodes,
  setAccessCodeStatus,
  updateAccessCode,
  createReplacementCode,
  terminateCampaign,
  listRedemptionsForCode,
  summarizeByCampaign,
  accessCodesToCsv,
  type AccessCode,
  type AccessCodeConfig,
  type AccessCodeRedemption,
} from '../lib/accessCodes';

type GenerationMode = 'batch' | 'named';

interface FormState {
  mode: GenerationMode;
  prefix: string;
  namedCode: string;
  count: number;
  campaignName: string;
  organizationName: string;
  accessDurationDays: number;
  maxRedemptions: number;
  unlimitedRedemptions: boolean;
  expiresAt: string;
  isComplimentary: boolean;
  discountPercent: string;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  mode: 'batch',
  prefix: 'NM',
  namedCode: '',
  count: 1,
  campaignName: '',
  organizationName: '',
  accessDurationDays: 90,
  maxRedemptions: 1,
  unlimitedRedemptions: false,
  expiresAt: '',
  isComplimentary: true,
  discountPercent: '',
  notes: '',
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const inputClass =
  'h-[48px] w-full rounded-[12px] border border-[rgba(255,255,255,0.25)] bg-[#131313] px-4 text-[14px] text-white placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#965cdf]';
const labelClass = 'text-[13px] text-[#8f8f8f]';

export const AccessCodes = () => {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [justCreated, setJustCreated] = useState<AccessCode[] | null>(null);

  const [editingCode, setEditingCode] = useState<AccessCode | null>(null);
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editUnlimitedRedemptions, setEditUnlimitedRedemptions] = useState(false);
  const [editMaxRedemptions, setEditMaxRedemptions] = useState(1);
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [replacingCode, setReplacingCode] = useState<AccessCode | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  const [terminatingCampaign, setTerminatingCampaign] = useState<string | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);

  const [historyCode, setHistoryCode] = useState<AccessCode | null>(null);
  const [historyRedemptions, setHistoryRedemptions] = useState<AccessCodeRedemption[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadCodes = async () => {
    setIsLoading(true);
    try {
      setCodes(await listAccessCodes());
    } catch {
      // listAccessCodes already surfaces its own error via notifications elsewhere;
      // an empty list here just means the table renders empty rather than crashing.
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const campaignSummaries = useMemo(() => summarizeByCampaign(codes), [codes]);

  const visibleCodes = useMemo(
    () => (statusFilter === 'all' ? codes : codes.filter((c) => c.status === statusFilter)),
    [codes, statusFilter]
  );

  const buildConfig = (): AccessCodeConfig => ({
    campaignName: form.campaignName.trim() || undefined,
    organizationName: form.organizationName.trim() || undefined,
    accessDurationDays: Number(form.accessDurationDays) || 0,
    // null must be sent explicitly for "unlimited" — omitting the field
    // entirely falls back to the collection's default of 1 (single-use).
    maxRedemptions: form.unlimitedRedemptions ? null : Number(form.maxRedemptions) || 1,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
    isComplimentary: form.isComplimentary,
    discountPercent: form.discountPercent ? Number(form.discountPercent) : undefined,
    notes: form.notes.trim() || undefined,
    status: 'active',
  });

  const handleGenerate = async () => {
    if (form.mode === 'batch' && (!form.count || form.count < 1)) {
      showWarning('Enter how many codes to generate.');
      return;
    }
    if (form.mode === 'named' && !form.namedCode.trim()) {
      showWarning('Enter a code.');
      return;
    }

    setIsCreating(true);
    setProgress(form.mode === 'batch' ? { done: 0, total: form.count } : null);
    try {
      const config = buildConfig();
      let created: AccessCode[];
      if (form.mode === 'named') {
        created = [await createNamedAccessCode(form.namedCode, config)];
      } else {
        created = await createAccessCodeBatch(form.prefix, form.count, config, {
          onProgress: (done, total) => setProgress({ done, total }),
        });
      }

      setJustCreated(created);
      showSuccess(
        created.length === 1
          ? `Code ${created[0].code} created.`
          : `${created.length} codes generated.`
      );
      await loadCodes();
    } catch {
      // createAccessCodeBatch/createNamedAccessCode already show a notification.
    } finally {
      setIsCreating(false);
      setProgress(null);
    }
  };

  const handleToggleStatus = async (code: AccessCode) => {
    const nextStatus = code.status === 'active' ? 'inactive' : 'active';
    try {
      await setAccessCodeStatus(code.$id, nextStatus);
      showSuccess(`${code.code} ${nextStatus === 'active' ? 'reactivated' : 'deactivated'}.`);
      await loadCodes();
    } catch {
      // setAccessCodeStatus already shows a notification.
    }
  };

  const handleOpenEdit = (code: AccessCode) => {
    setEditingCode(code);
    setEditExpiresAt(code.expiresAt ? code.expiresAt.slice(0, 10) : '');
    setEditUnlimitedRedemptions(code.maxRedemptions === null);
    setEditMaxRedemptions(code.maxRedemptions ?? 1);
    setEditNotes(code.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingCode) return;
    setIsSavingEdit(true);
    try {
      await updateAccessCode(editingCode.$id, {
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        maxRedemptions: editUnlimitedRedemptions ? null : Number(editMaxRedemptions) || 1,
        notes: editNotes.trim() || undefined,
      });
      showSuccess(`${editingCode.code} updated.`);
      setEditingCode(null);
      await loadCodes();
    } catch {
      // updateAccessCode already shows a notification.
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleReplace = async () => {
    if (!replacingCode) return;
    setIsReplacing(true);
    try {
      const replacement = await createReplacementCode(replacingCode);
      showSuccess(`${replacingCode.code} deactivated. New code: ${replacement.code}`);
      setReplacingCode(null);
      await loadCodes();
    } catch {
      // createReplacementCode already shows a notification.
    } finally {
      setIsReplacing(false);
    }
  };

  const handleTerminateCampaign = async () => {
    if (!terminatingCampaign) return;
    setIsTerminating(true);
    try {
      const campaignCodes = codes.filter(
        (c) => (c.campaignName?.trim() || 'Uncategorized') === terminatingCampaign
      );
      const count = await terminateCampaign(campaignCodes);
      showSuccess(
        count > 0
          ? `Deactivated ${count} code${count === 1 ? '' : 's'} in "${terminatingCampaign}".`
          : `No active codes to deactivate in "${terminatingCampaign}".`
      );
      setTerminatingCampaign(null);
      await loadCodes();
    } catch {
      // terminateCampaign already shows a notification.
    } finally {
      setIsTerminating(false);
    }
  };

  const handleOpenHistory = async (code: AccessCode) => {
    setHistoryCode(code);
    setHistoryRedemptions(null);
    setIsLoadingHistory(true);
    try {
      setHistoryRedemptions(await listRedemptionsForCode(code.$id));
    } catch {
      setHistoryRedemptions([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess('Copied to clipboard.');
    } catch {
      showWarning('Could not copy to clipboard.');
    }
  };

  const handleExportAll = () => {
    downloadCsv(`nevermore-access-codes-${new Date().toISOString().slice(0, 10)}.csv`, accessCodesToCsv(visibleCodes));
  };

  const columns: Column<AccessCode & Record<string, unknown>>[] = [
    { key: 'code', label: 'Code', render: (v) => <span className="font-mono">{String(v)}</span> },
    { key: 'campaignName', label: 'Campaign', render: (v) => (v ? String(v) : '—') },
    { key: 'organizationName', label: 'Organization', render: (v) => (v ? String(v) : '—') },
    {
      key: 'redemptionCount',
      label: 'Redeemed',
      render: (_v, row) => `${row.redemptionCount} / ${row.maxRedemptions === null ? '∞' : row.maxRedemptions}`,
    },
    {
      key: 'accessDurationDays',
      label: 'Access Duration',
      render: (v) => (Number(v) > 0 ? `${v} days` : 'No expiry'),
    },
    {
      key: 'expiresAt',
      label: 'Code Expires',
      render: (v) => (v ? new Date(String(v)).toLocaleDateString() : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span
          className={`rounded-full px-3 py-1 text-[12px] ${
            v === 'active' ? 'bg-[rgba(34,197,94,0.15)] text-green-400' : 'bg-[rgba(255,255,255,0.08)] text-[#8f8f8f]'
          }`}
        >
          {String(v)}
        </span>
      ),
    },
    {
      key: '$id',
      label: 'Actions',
      render: (_v, row) => (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleCopy(row.code)}
            className="rounded-[8px] border border-[rgba(255,255,255,0.2)] px-3 py-1.5 text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)]"
          >
            Copy
          </button>
          <button
            onClick={() => handleToggleStatus(row)}
            className="rounded-[8px] border border-[rgba(255,255,255,0.2)] px-3 py-1.5 text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)]"
          >
            {row.status === 'active' ? 'Deactivate' : 'Reactivate'}
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="rounded-[8px] border border-[rgba(255,255,255,0.2)] px-3 py-1.5 text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)]"
          >
            Edit
          </button>
          <button
            onClick={() => setReplacingCode(row)}
            className="rounded-[8px] border border-[rgba(255,255,255,0.2)] px-3 py-1.5 text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)]"
          >
            Replace
          </button>
          <button
            onClick={() => handleOpenHistory(row)}
            className="rounded-[8px] border border-[rgba(255,255,255,0.2)] px-3 py-1.5 text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)]"
          >
            History
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-neutral-950 min-h-screen p-4 sm:p-6 lg:p-8">
      <h1
        className="mb-6 text-white text-[20px] leading-tight sm:mb-8 sm:text-[24px] sm:leading-[normal]"
        style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
      >
        Access Codes
      </h1>

      {/* Campaign summary */}
      {campaignSummaries.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaignSummaries.map((summary) => (
            <div
              key={summary.campaignName}
              className="rounded-[16px] bg-[rgba(255,255,255,0.07)] p-4 backdrop-blur-[10px]"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="truncate text-[14px] font-medium text-white">{summary.campaignName}</p>
                <button
                  onClick={() => setTerminatingCampaign(summary.campaignName)}
                  className="shrink-0 rounded-[8px] border border-[rgba(239,68,68,0.4)] px-2.5 py-1 text-[11px] text-red-400 hover:bg-[rgba(239,68,68,0.1)]"
                >
                  Terminate
                </button>
              </div>
              <p className="text-[12px] text-[#8f8f8f]">Codes issued: {summary.codesIssued}</p>
              <p className="text-[12px] text-[#8f8f8f]">
                Redeemed: {summary.codesRedeemed} / {summary.totalRedemptionCapacity === null ? '∞' : summary.totalRedemptionCapacity}
              </p>
              <p className="text-[12px] text-[#8f8f8f]">
                Redemption rate: {summary.redemptionRate === null ? '—' : `${(summary.redemptionRate * 100).toFixed(1)}%`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="mb-8 rounded-[16px] bg-[rgba(255,255,255,0.07)] p-4 backdrop-blur-[10px] sm:p-6">
        <h2 className="mb-4 text-[16px] text-white" style={{ fontFamily: 'Cinzel, serif', fontWeight: 550 }}>
          Generate Codes
        </h2>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setForm((f) => ({ ...f, mode: 'batch' }))}
            className={`rounded-[10px] px-4 py-2 text-[13px] ${
              form.mode === 'batch' ? 'bg-[#8549c9] text-white' : 'bg-[rgba(255,255,255,0.08)] text-[#8f8f8f]'
            }`}
          >
            Batch (unique codes)
          </button>
          <button
            onClick={() => setForm((f) => ({ ...f, mode: 'named' }))}
            className={`rounded-[10px] px-4 py-2 text-[13px] ${
              form.mode === 'named' ? 'bg-[#8549c9] text-white' : 'bg-[rgba(255,255,255,0.08)] text-[#8f8f8f]'
            }`}
          >
            Single reusable code
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {form.mode === 'batch' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Code prefix</label>
                <input
                  className={inputClass}
                  value={form.prefix}
                  maxLength={8}
                  placeholder="e.g. AAC"
                  onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Number of codes</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.count}
                  onChange={(e) => setForm((f) => ({ ...f, count: Number(e.target.value) }))}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className={labelClass}>Code</label>
              <input
                className={`${inputClass} font-mono uppercase`}
                value={form.namedCode}
                placeholder="e.g. AAC-PILOT-2026"
                onChange={(e) => setForm((f) => ({ ...f, namedCode: e.target.value }))}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Campaign name</label>
            <input
              className={inputClass}
              value={form.campaignName}
              placeholder="e.g. Anne Arundel County Pilot"
              onChange={(e) => setForm((f) => ({ ...f, campaignName: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Organization</label>
            <input
              className={inputClass}
              value={form.organizationName}
              onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Access duration (days, 0 = no expiry)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.accessDurationDays}
              onChange={(e) => setForm((f) => ({ ...f, accessDurationDays: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              {form.mode === 'named' ? 'Maximum redemptions (this code)' : 'Redemptions per code'}
            </label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.maxRedemptions}
              disabled={form.unlimitedRedemptions}
              onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: Number(e.target.value) }))}
            />
            <label className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={form.unlimitedRedemptions}
                onChange={(e) => setForm((f) => ({ ...f, unlimitedRedemptions: e.target.checked }))}
                className="h-4 w-4"
              />
              <span className="text-[13px] text-white">Unlimited redemptions</span>
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Code expiration date (optional)</label>
            <input
              type="date"
              className={inputClass}
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Discount % (if not complimentary)</label>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={form.discountPercent}
              disabled={form.isComplimentary}
              onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="isComplimentary"
              checked={form.isComplimentary}
              onChange={(e) => setForm((f) => ({ ...f, isComplimentary: e.target.checked }))}
              className="h-4 w-4"
            />
            <label htmlFor="isComplimentary" className="text-[14px] text-white">
              Complimentary access
            </label>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <label className={labelClass}>Notes (internal)</label>
            <input
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Button onClick={handleGenerate} disabled={isCreating} className="w-auto px-8">
            {isCreating
              ? progress
                ? `Generating ${progress.done}/${progress.total}...`
                : 'Generating...'
              : 'Generate'}
          </Button>
        </div>

        {justCreated && (
          <div className="mt-6 rounded-[12px] border border-[rgba(150,92,223,0.4)] bg-[rgba(150,92,223,0.08)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14px] text-white">
                {justCreated.length === 1 ? '1 code created' : `${justCreated.length} codes created`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(justCreated.map((c) => c.code).join('\n'))}
                  className="rounded-[8px] border border-[rgba(255,255,255,0.2)] px-3 py-1.5 text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)]"
                >
                  Copy all
                </button>
                <button
                  onClick={() => downloadCsv('nevermore-new-access-codes.csv', accessCodesToCsv(justCreated))}
                  className="rounded-[8px] border border-[rgba(255,255,255,0.2)] px-3 py-1.5 text-[12px] text-white hover:bg-[rgba(255,255,255,0.08)]"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => setJustCreated(null)}
                  className="rounded-[8px] px-3 py-1.5 text-[12px] text-[#8f8f8f] hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-[13px] text-[#c4b5d8]">
              {justCreated.map((c) => (
                <div key={c.$id}>{c.code}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Codes list */}
      <div className="rounded-[16px] bg-[rgba(255,255,255,0.07)] p-4 backdrop-blur-[10px] sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] text-white" style={{ fontFamily: 'Cinzel, serif', fontWeight: 550 }}>
            All Codes ({visibleCodes.length})
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="h-[40px] rounded-[10px] border border-[rgba(255,255,255,0.25)] bg-[#131313] px-3 text-[13px] text-white"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              onClick={handleExportAll}
              className="rounded-[10px] border border-[rgba(255,255,255,0.2)] px-4 py-2 text-[13px] text-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              Export CSV
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-[14px] text-[#8f8f8f]">Loading...</p>
        ) : visibleCodes.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-[#8f8f8f]">No access codes yet.</p>
        ) : (
          <DataTable columns={columns} data={visibleCodes as (AccessCode & Record<string, unknown>)[]} />
        )}
      </div>

      {/* Edit modal: extend/clear expiration, adjust redemption limit, notes */}
      {editingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => !isSavingEdit && setEditingCode(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-[420px] max-w-[92vw] rounded-[16px] bg-[rgba(255,255,255,0.1)] p-6 backdrop-blur-[10px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[20px] text-white" style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}>
                Edit {editingCode.code}
              </h2>
              <button onClick={() => setEditingCode(null)} disabled={isSavingEdit} aria-label="Close">
                <CloseIcon width={20} height={20} color="#fff" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Code expiration date (blank = never)</label>
                <input
                  type="date"
                  className={inputClass}
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Maximum redemptions</label>
                <input
                  type="number"
                  min={editingCode.redemptionCount || 1}
                  className={inputClass}
                  value={editMaxRedemptions}
                  disabled={editUnlimitedRedemptions}
                  onChange={(e) => setEditMaxRedemptions(Number(e.target.value))}
                />
                <label className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={editUnlimitedRedemptions}
                    onChange={(e) => setEditUnlimitedRedemptions(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-[13px] text-white">Unlimited redemptions</span>
                </label>
                <p className="text-[11px] text-[#6b6b6b]">Already redeemed {editingCode.redemptionCount} time{editingCode.redemptionCount === 1 ? '' : 's'}.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Notes (internal)</label>
                <input className={inputClass} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="h-[48px] flex-1 rounded-[12px] bg-[#965CDF] text-[14px] text-white hover:bg-[#8549c9] disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Save changes'}
              </button>
              <button
                onClick={() => setEditingCode(null)}
                disabled={isSavingEdit}
                className="h-[48px] flex-1 rounded-[12px] border border-[rgba(255,255,255,0.25)] bg-[#131313] text-[14px] text-white hover:bg-[#1a1a1a] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redemption history */}
      {historyCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setHistoryCode(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-[480px] max-w-[92vw] max-h-[80vh] overflow-y-auto rounded-[16px] bg-[rgba(255,255,255,0.1)] p-6 backdrop-blur-[10px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[20px] text-white" style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}>
                Redemptions — {historyCode.code}
              </h2>
              <button onClick={() => setHistoryCode(null)} aria-label="Close">
                <CloseIcon width={20} height={20} color="#fff" />
              </button>
            </div>

            {isLoadingHistory ? (
              <p className="py-6 text-center text-[13px] text-[#8f8f8f]">Loading...</p>
            ) : !historyRedemptions || historyRedemptions.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#8f8f8f]">No redemptions yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {historyRedemptions.map((r) => (
                  <div key={r.$id} className="rounded-[10px] bg-[rgba(255,255,255,0.05)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] text-[#c4b5d8]">{r.userId}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          r.status === 'active' ? 'bg-[rgba(34,197,94,0.15)] text-green-400' : 'bg-[rgba(255,255,255,0.08)] text-[#8f8f8f]'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-[#8f8f8f]">
                      Redeemed {new Date(r.redeemedAt).toLocaleString()}
                    </p>
                    <p className="text-[12px] text-[#8f8f8f]">
                      Access {r.accessExpiresAt ? `until ${new Date(r.accessExpiresAt).toLocaleDateString()}` : 'never expires'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!replacingCode}
        onClose={() => !isReplacing && setReplacingCode(null)}
        onConfirm={handleReplace}
        title="Replace Code"
        itemName={replacingCode?.code}
        isLoading={isReplacing}
        actionVerb="replace"
        confirmLabel="Replace"
        confirmingLabel="Replacing..."
        description="The current code will be deactivated (its redemption history stays intact) and a new active code with the same configuration will be issued."
      />

      <ConfirmDeleteModal
        isOpen={!!terminatingCampaign}
        onClose={() => !isTerminating && setTerminatingCampaign(null)}
        onConfirm={handleTerminateCampaign}
        title="Terminate Campaign"
        itemName={terminatingCampaign || undefined}
        isLoading={isTerminating}
        actionVerb="terminate"
        confirmLabel="Terminate"
        confirmingLabel="Terminating..."
        description="Every currently active code in this campaign will be deactivated. Codes already redeemed keep the access they granted — this only stops further redemptions."
      />
    </div>
  );
};
