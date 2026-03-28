import type { DashboardConfig } from '@shared/types.js';

interface Props {
  dashboardConfig: DashboardConfig | null;
  scanDirsDraft: string;
  onScanDirsDraftChange: (value: string) => void;
  onSubmit: (e: Event) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
  configError: string | null;
  configLoading: boolean;
}

export function ConfigurationPanel({
  dashboardConfig,
  scanDirsDraft,
  onScanDirsDraftChange,
  onSubmit,
  onCancel,
  saving,
  saveError,
  configError,
  configLoading,
}: Props) {
  return (
    <section class="mb-8 rounded-2xl border border-sky-500/20 bg-slate-900/80 p-6 shadow-[0_20px_80px_rgba(14,165,233,0.08)]">
      <div class="max-w-3xl">
        <p class="text-xs font-mono uppercase tracking-[0.28em] text-sky-400/80">Configuration</p>
        <h2 class="mt-3 text-xl font-semibold text-white">Scan directories</h2>
        <p class="mt-3 text-sm leading-6 text-slate-400">
          Update the parent folders dev-dashboard watches for `.dev/` and `.dev-archive/` trees.
          Changes are saved to the shared dashboard config and applied to both `/dev-dashboard` and
          `dev-dashboard`.
        </p>
        <form class="mt-6 space-y-4" onSubmit={onSubmit}>
          <label class="block">
            <span class="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-slate-500">
              One path per line
            </span>
            <textarea
              value={scanDirsDraft}
              onInput={(e) => onScanDirsDraftChange((e.target as HTMLTextAreaElement).value)}
              rows={4}
              placeholder={'~/code\n~/work'}
              class="w-full rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
            />
          </label>
          <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <button
              type="submit"
              disabled={saving}
              class="inline-flex items-center rounded-lg bg-sky-500/15 px-4 py-2 font-mono text-sky-300 ring-1 ring-inset ring-sky-500/30 transition-colors hover:bg-sky-500/20 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save scan directories'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              class="inline-flex items-center rounded-lg bg-slate-900/70 px-4 py-2 font-mono text-slate-400 ring-1 ring-inset ring-slate-700/50 transition-colors hover:bg-slate-900 hover:text-slate-200"
            >
              Cancel
            </button>
            <span>
              Saved to{' '}
              <code class="font-mono text-slate-400">~/.config/dev-dashboard/config.json</code>
            </span>
          </div>
          {dashboardConfig && dashboardConfig.scanDirs.length > 0 && (
            <p class="text-xs font-mono text-slate-600">
              Current roots: {dashboardConfig.scanDirs.join(', ')}
            </p>
          )}
          {saveError && <p class="text-sm text-rose-400">{saveError}</p>}
          {configError && <p class="text-sm text-rose-400">{configError}</p>}
          {configLoading && <p class="text-sm text-slate-500">Loading dashboard config...</p>}
        </form>
      </div>
    </section>
  );
}
