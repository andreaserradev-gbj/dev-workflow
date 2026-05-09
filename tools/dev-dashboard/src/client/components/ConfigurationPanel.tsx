import { useRef, useState } from 'preact/hooks';
import type { DashboardConfigResponse } from '@shared/types.js';
import {
  getPlatformPresets,
  isTerminalDraftDirty,
  platformLabel,
  type TerminalDraft,
} from '../terminal-presets.js';

type TabId = 'scanDirs' | 'terminal' | 'notifications' | 'about';

const TABS: { id: TabId; label: string }[] = [
  { id: 'scanDirs', label: 'Scan dirs' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'about', label: 'About' },
];

interface Props {
  dashboardConfig: DashboardConfigResponse | null;
  scanDirsDraft: string;
  onScanDirsDraftChange: (value: string) => void;
  onSubmit: (e: Event) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
  configError: string | null;
  configLoading: boolean;
  terminalDraft: TerminalDraft;
  onTerminalDraftChange: (next: TerminalDraft) => void;
  onSubmitTerminal: (e: Event) => void | Promise<void>;
  onCancelTerminal: () => void;
  savingTerminal: boolean;
  saveTerminalError: string | null;
  notificationsDraft: boolean;
  onNotificationsDraftChange: (next: boolean) => void;
  onSubmitNotifications: (e: Event) => void | Promise<void>;
  onCancelNotifications: () => void;
  savingNotifications: boolean;
  saveNotificationsError: string | null;
  projectsCount: number;
  featuresCount: number;
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
  terminalDraft,
  onTerminalDraftChange,
  onSubmitTerminal,
  onCancelTerminal,
  savingTerminal,
  saveTerminalError,
  notificationsDraft,
  onNotificationsDraftChange,
  onSubmitNotifications,
  onCancelNotifications,
  savingNotifications,
  saveNotificationsError,
  projectsCount,
  featuresCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('scanDirs');
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    scanDirs: null,
    terminal: null,
    notifications: null,
    about: null,
  });

  const handleTabKeyDown = (e: KeyboardEvent, currentId: TabId) => {
    const idx = TABS.findIndex((t) => t.id === currentId);
    if (idx < 0) return;
    let nextIdx: number;
    switch (e.key) {
      case 'ArrowRight':
        nextIdx = (idx + 1) % TABS.length;
        break;
      case 'ArrowLeft':
        nextIdx = (idx - 1 + TABS.length) % TABS.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = TABS.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const nextId = TABS[nextIdx].id;
    setActiveTab(nextId);
    tabRefs.current[nextId]?.focus();
  };

  return (
    <section class="mb-8 rounded-2xl border border-sky-500/20 bg-slate-900/80 p-6 shadow-[0_20px_80px_rgba(14,165,233,0.08)]">
      <div class="max-w-3xl">
        <p class="text-xs font-mono uppercase tracking-[0.28em] text-sky-400/80">Configuration</p>
        <div
          role="tablist"
          aria-label="Configuration sections"
          class="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-slate-900/70 p-1 ring-1 ring-inset ring-slate-700/50"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`config-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`config-tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                class={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30'
                    : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <ScanDirsTab
          active={activeTab === 'scanDirs'}
          dashboardConfig={dashboardConfig}
          scanDirsDraft={scanDirsDraft}
          onScanDirsDraftChange={onScanDirsDraftChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
          saving={saving}
          saveError={saveError}
          configError={configError}
          configLoading={configLoading}
        />
        <TerminalTab
          active={activeTab === 'terminal'}
          dashboardConfig={dashboardConfig}
          terminalDraft={terminalDraft}
          onTerminalDraftChange={onTerminalDraftChange}
          onSubmit={onSubmitTerminal}
          onCancel={onCancelTerminal}
          saving={savingTerminal}
          saveError={saveTerminalError}
        />
        <NotificationsTab
          active={activeTab === 'notifications'}
          dashboardConfig={dashboardConfig}
          notificationsDraft={notificationsDraft}
          onNotificationsDraftChange={onNotificationsDraftChange}
          onSubmit={onSubmitNotifications}
          onCancel={onCancelNotifications}
          saving={savingNotifications}
          saveError={saveNotificationsError}
        />
        <AboutTab
          active={activeTab === 'about'}
          dashboardConfig={dashboardConfig}
          projectsCount={projectsCount}
          featuresCount={featuresCount}
        />
      </div>
    </section>
  );
}

// ─── Tab subcomponents ───────────────────────────────────────────
// Inline single-consumer pattern (mirrors FeaturePanel.tsx). Each tab takes
// `active` (visibility) and `dashboardConfig`; Phase 3 will expand TerminalTab
// with form draft + save handler props, Phase 4 will expand
// NotificationsTab/AboutTab. Prop shapes are locked here so downstream phases
// only fill in bodies, not signatures.

interface ScanDirsTabProps {
  active: boolean;
  dashboardConfig: DashboardConfigResponse | null;
  scanDirsDraft: string;
  onScanDirsDraftChange: (value: string) => void;
  onSubmit: (e: Event) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
  configError: string | null;
  configLoading: boolean;
}

function ScanDirsTab({
  active,
  dashboardConfig,
  scanDirsDraft,
  onScanDirsDraftChange,
  onSubmit,
  onCancel,
  saving,
  saveError,
  configError,
  configLoading,
}: ScanDirsTabProps) {
  return (
    <div
      role="tabpanel"
      id="config-tabpanel-scanDirs"
      aria-labelledby="config-tab-scanDirs"
      tabIndex={0}
      hidden={!active}
      class="mt-6"
    >
      <h2 class="text-xl font-semibold text-white">Scan directories</h2>
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
  );
}

interface TerminalTabProps {
  active: boolean;
  dashboardConfig: DashboardConfigResponse | null;
  terminalDraft: TerminalDraft;
  onTerminalDraftChange: (next: TerminalDraft) => void;
  onSubmit: (e: Event) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
}

function TerminalTab({
  active,
  dashboardConfig,
  terminalDraft,
  onTerminalDraftChange,
  onSubmit,
  onCancel,
  saving,
  saveError,
}: TerminalTabProps) {
  const platform = dashboardConfig?.platform ?? '';
  const presets = getPlatformPresets(platform);
  const supported = presets.length > 0;
  const dirty = dashboardConfig
    ? isTerminalDraftDirty(terminalDraft, dashboardConfig.terminal, platform)
    : false;
  const isCustom = terminalDraft.selection === 'custom';

  return (
    <div
      role="tabpanel"
      id="config-tabpanel-terminal"
      aria-labelledby="config-tab-terminal"
      tabIndex={0}
      hidden={!active}
      class="mt-6"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xl font-semibold text-white">Terminal application</h2>
        {dashboardConfig && (
          <span class="inline-flex items-center gap-1.5 rounded-md bg-slate-800/60 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400 ring-1 ring-inset ring-slate-700/50">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
            {platformLabel(platform)}
          </span>
        )}
      </div>
      <p class="mt-3 text-sm leading-6 text-slate-400">
        Pick which terminal opens when you click the terminal icon in a feature panel toolbar.
        Custom mode passes the binary and arguments as discrete strings — no shell parsing.
      </p>

      {!supported ? (
        <p class="mt-6 text-sm text-slate-500">
          Terminal configuration is not supported on{' '}
          <code class="font-mono text-slate-400">{platform || 'this platform'}</code>. Open in
          Terminal will fall back to the system default.
        </p>
      ) : (
        <form class="mt-6 space-y-5" onSubmit={onSubmit}>
          <label class="block">
            <span class="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-slate-500">
              Application
            </span>
            <select
              value={terminalDraft.selection}
              onChange={(e) =>
                onTerminalDraftChange({
                  ...terminalDraft,
                  selection: (e.target as HTMLSelectElement).value,
                })
              }
              class="w-full rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
            >
              <option value="">Default (system Open in Terminal)</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option disabled>──────────</option>
              <option value="custom">Custom…</option>
            </select>
          </label>

          {isCustom && (
            <>
              <label class="block">
                <span class="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-slate-500">
                  Command
                </span>
                <input
                  type="text"
                  value={terminalDraft.customCmd}
                  placeholder="/Applications/WezTerm.app/Contents/MacOS/wezterm-gui"
                  onInput={(e) =>
                    onTerminalDraftChange({
                      ...terminalDraft,
                      customCmd: (e.target as HTMLInputElement).value,
                    })
                  }
                  class="w-full rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-3 font-mono text-[13px] text-emerald-300/90 placeholder:text-slate-600 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
                />
              </label>

              <label class="block">
                <span class="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-slate-500">
                  Arguments · one per line
                </span>
                <textarea
                  value={terminalDraft.customArgs}
                  rows={4}
                  placeholder={'start\n--cwd\n{{cwd}}'}
                  onInput={(e) =>
                    onTerminalDraftChange({
                      ...terminalDraft,
                      customArgs: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                  class="w-full rounded-xl border border-slate-700/60 bg-slate-950/80 px-4 py-3 font-mono text-[13px] text-slate-300 placeholder:text-slate-600 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
                />
                <p class="mt-2 text-[11px] font-mono text-slate-600 leading-relaxed">
                  <span class="text-cyan-300/90">{'{{cwd}}'}</span> is replaced with the feature
                  directory at launch.
                </p>
              </label>
            </>
          )}

          <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
            <button
              type="submit"
              disabled={saving || !dirty}
              class="inline-flex items-center rounded-lg bg-sky-500/15 px-4 py-2 font-mono text-sky-300 ring-1 ring-inset ring-sky-500/30 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save terminal'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || !dirty}
              class="inline-flex items-center rounded-lg bg-slate-900/70 px-4 py-2 font-mono text-slate-400 ring-1 ring-inset ring-slate-700/50 transition-colors hover:bg-slate-900 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>

          {saveError && <p class="text-sm text-rose-400">{saveError}</p>}

          <p class="text-[11px] font-mono text-slate-600 leading-relaxed pt-3">
            Other platforms keep their defaults — edit{' '}
            <code class="text-slate-500">~/.config/dev-dashboard/config.json</code> directly to
            customize them.
          </p>
        </form>
      )}
    </div>
  );
}

// Reusable on/off control. Renders as a `role="switch"` button so Space and
// Enter natively toggle without custom keyboard handling. Visible label sits
// alongside the switch and is wired via `aria-labelledby`.
interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

function Toggle({ id, checked, onChange, label, description, disabled = false }: ToggleProps) {
  return (
    <div class="flex items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        class={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:ring-offset-2 focus:ring-offset-slate-900 ${
          checked
            ? 'bg-sky-500/40 ring-1 ring-inset ring-sky-500/40'
            : 'bg-slate-800/80 ring-1 ring-inset ring-slate-700/50'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <span
          aria-hidden="true"
          class={`inline-block h-4 w-4 transform rounded-full bg-slate-100 shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <div class="flex-1 -mt-0.5">
        <span id={`${id}-label`} class="block text-sm font-medium text-slate-200">
          {label}
        </span>
        {description && (
          <span id={`${id}-desc`} class="mt-1 block text-xs leading-5 text-slate-500">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

interface NotificationsTabProps {
  active: boolean;
  dashboardConfig: DashboardConfigResponse | null;
  notificationsDraft: boolean;
  onNotificationsDraftChange: (next: boolean) => void;
  onSubmit: (e: Event) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
}

function NotificationsTab({
  active,
  dashboardConfig,
  notificationsDraft,
  onNotificationsDraftChange,
  onSubmit,
  onCancel,
  saving,
  saveError,
}: NotificationsTabProps) {
  const dirty = dashboardConfig ? notificationsDraft !== dashboardConfig.notifications : false;
  return (
    <div
      role="tabpanel"
      id="config-tabpanel-notifications"
      aria-labelledby="config-tab-notifications"
      tabIndex={0}
      hidden={!active}
      class="mt-6"
    >
      <h2 class="text-xl font-semibold text-white">Notifications</h2>
      <p class="mt-3 text-sm leading-6 text-slate-400">
        Surface desktop notifications when watched features cross status boundaries (active → gate →
        complete). The setting is persisted alongside the rest of the dashboard config.
      </p>
      <form class="mt-6 space-y-5" onSubmit={onSubmit}>
        <Toggle
          id="notifications-toggle"
          checked={notificationsDraft}
          onChange={onNotificationsDraftChange}
          label="Enable notifications"
          description="The dashboard does not yet emit notifications — saving this just persists your preference for when the daemon ships."
        />
        <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
          <button
            type="submit"
            disabled={saving || !dirty}
            class="inline-flex items-center rounded-lg bg-sky-500/15 px-4 py-2 font-mono text-sky-300 ring-1 ring-inset ring-sky-500/30 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save notifications'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || !dirty}
            class="inline-flex items-center rounded-lg bg-slate-900/70 px-4 py-2 font-mono text-slate-400 ring-1 ring-inset ring-slate-700/50 transition-colors hover:bg-slate-900 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        {saveError && <p class="text-sm text-rose-400">{saveError}</p>}
      </form>
    </div>
  );
}

interface AboutTabProps {
  active: boolean;
  dashboardConfig: DashboardConfigResponse | null;
  projectsCount: number;
  featuresCount: number;
}

function AboutTab({ active, dashboardConfig, projectsCount, featuresCount }: AboutTabProps) {
  return (
    <div
      role="tabpanel"
      id="config-tabpanel-about"
      aria-labelledby="config-tab-about"
      tabIndex={0}
      hidden={!active}
      class="mt-6"
    >
      <h2 class="text-xl font-semibold text-white">About</h2>
      <p class="mt-3 text-sm leading-6 text-slate-400">
        Build info, config location, and a quick read on what the dashboard is currently watching.
      </p>
      <dl class="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-[max-content_1fr]">
        <dt class="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Version</dt>
        <dd class="font-mono text-slate-200">{dashboardConfig?.version ?? '—'}</dd>

        <dt class="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Platform</dt>
        <dd class="text-slate-200">
          {dashboardConfig ? platformLabel(dashboardConfig.platform) : '—'}
          {dashboardConfig && (
            <span class="ml-2 font-mono text-xs text-slate-500">({dashboardConfig.platform})</span>
          )}
        </dd>

        <dt class="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Config file</dt>
        <dd class="font-mono text-xs text-slate-300 break-all">
          {dashboardConfig?.configPath ?? '—'}
        </dd>

        <dt class="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Projects</dt>
        <dd class="font-mono text-slate-200">{projectsCount}</dd>

        <dt class="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Features</dt>
        <dd class="font-mono text-slate-200">{featuresCount}</dd>
      </dl>
    </div>
  );
}
