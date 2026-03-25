import { useState } from 'preact/hooks';
import type { FeatureStatus, Project } from '@shared/types.js';
import { FeatureRow } from './FeatureRow.js';
import { FeaturePanel } from './FeaturePanel.js';
import { buildStatusGradient } from '../utils/statusColors.js';

interface Props {
  project: Project;
  singleProject?: boolean;
  archivedFilter?: boolean;
}

const STORAGE_KEY_PREFIX = 'dev-dashboard-collapsed:';
const ARCHIVE_KEY_PREFIX = 'dev-dashboard-archive-collapsed:';

function isCollapsedInit(name: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + name) === '1';
  } catch {
    return false;
  }
}

function persistCollapsed(name: string, collapsed: boolean): void {
  try {
    if (collapsed) {
      localStorage.setItem(STORAGE_KEY_PREFIX + name, '1');
    } else {
      localStorage.removeItem(STORAGE_KEY_PREFIX + name);
    }
  } catch {
    // localStorage unavailable
  }
}

const HIGHLIGHT_STATUSES: FeatureStatus[] = ['gate', 'active', 'stale'];

function buildSummary(project: Project): string {
  const activeFeatures = project.features.filter((f) => f.status !== 'archived');
  const archivedCount = project.features.length - activeFeatures.length;
  const parts: string[] = [
    `${activeFeatures.length} feature${activeFeatures.length !== 1 ? 's' : ''}`,
  ];
  for (const status of HIGHLIGHT_STATUSES) {
    const count = activeFeatures.filter((f) => f.status === status).length;
    if (count > 0) parts.push(`${count} ${status}`);
  }
  if (archivedCount > 0) parts.push(`${archivedCount} archived`);
  return parts.join(' \u00b7 ');
}

function isArchiveCollapsedInit(name: string): boolean {
  try {
    return localStorage.getItem(ARCHIVE_KEY_PREFIX + name) !== '0';
  } catch {
    return true; // collapsed by default
  }
}

function persistArchiveCollapsed(name: string, collapsed: boolean): void {
  try {
    if (collapsed) {
      localStorage.removeItem(ARCHIVE_KEY_PREFIX + name);
    } else {
      localStorage.setItem(ARCHIVE_KEY_PREFIX + name, '0');
    }
  } catch {
    // localStorage unavailable
  }
}

export function ProjectCard({ project, singleProject, archivedFilter }: Props) {
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() =>
    singleProject ? false : isCollapsedInit(project.name),
  );
  const [archiveCollapsed, setArchiveCollapsed] = useState(() =>
    isArchiveCollapsedInit(project.name),
  );

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      persistCollapsed(project.name, next);
      return next;
    });
  }

  function toggleArchiveCollapsed() {
    setArchiveCollapsed((prev) => {
      const next = !prev;
      persistArchiveCollapsed(project.name, next);
      return next;
    });
  }

  const isCollapsed = singleProject ? false : collapsed;
  const activeFeatures = project.features.filter((f) => f.status !== 'archived');
  const archivedFeatures = project.features.filter((f) => f.status === 'archived');
  const gradient = buildStatusGradient(project.features);

  return (
    <div class="relative rounded-xl bg-[#0d1425] border border-slate-800/60 overflow-hidden shadow-md shadow-black/20">
      {/* Right status bar */}
      {gradient && (
        <div
          class="absolute right-0 top-0 bottom-0 w-[3px] rounded-l-sm z-10"
          style={{ background: gradient }}
        />
      )}
      {singleProject ? (
        <div class="w-full px-5 py-4 border-b border-slate-800/60 flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <h2 class="text-base font-semibold text-white font-sans tracking-tight">
              {project.name}
            </h2>
            <span class="text-xs text-slate-500 font-mono">{buildSummary(project)}</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggleCollapsed}
          class="w-full px-5 py-4 border-b border-slate-800/60 flex items-center justify-between
                 cursor-pointer hover:bg-slate-800/20 transition-colors text-left"
        >
          <div class="flex items-center gap-3">
            <span class="text-slate-500 text-[10px] w-3 flex-shrink-0 select-none">
              {isCollapsed ? '\u25b6' : '\u25bc'}
            </span>
            <h2 class="text-base font-semibold text-white font-sans tracking-tight">
              {project.name}
            </h2>
            <span class="text-xs text-slate-500 font-mono">{buildSummary(project)}</span>
          </div>
        </button>
      )}

      {!isCollapsed && (
        <div class="divide-y divide-slate-800/30">
          {activeFeatures.map((feature) => (
            <div key={feature.name}>
              <FeatureRow
                feature={feature}
                projectPath={project.path}
                id={`feature-${project.name}-${feature.name}`}
                expanded={expandedFeature === feature.name}
                onClick={() =>
                  setExpandedFeature((prev) => (prev === feature.name ? null : feature.name))
                }
              />
              {expandedFeature === feature.name && (
                <FeaturePanel
                  project={project.name}
                  projectPath={project.path}
                  featureName={feature.name}
                  feature={feature}
                />
              )}
            </div>
          ))}
          {archivedFeatures.length > 0 && !archivedFilter && (
            <>
              <button
                type="button"
                onClick={toggleArchiveCollapsed}
                class="w-full px-5 py-2 flex items-center gap-2 text-xs text-slate-600 font-mono
                       hover:bg-slate-800/20 transition-colors cursor-pointer"
              >
                <span class="text-[10px] w-3 select-none">
                  {archiveCollapsed ? '\u25b6' : '\u25bc'}
                </span>
                Archive ({archivedFeatures.length})
              </button>
              {!archiveCollapsed &&
                archivedFeatures.map((feature) => (
                  <div key={feature.name}>
                    <FeatureRow
                      feature={feature}
                      projectPath={project.path}
                      id={`feature-${project.name}-${feature.name}`}
                      expanded={expandedFeature === feature.name}
                      onClick={() =>
                        setExpandedFeature((prev) => (prev === feature.name ? null : feature.name))
                      }
                    />
                    {expandedFeature === feature.name && (
                      <FeaturePanel
                        project={project.name}
                        projectPath={project.path}
                        featureName={feature.name}
                        feature={feature}
                      />
                    )}
                  </div>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
