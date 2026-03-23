import { useCallback } from 'preact/hooks';
import { ProjectCard } from './components/ProjectCard.js';
import { SessionBar } from './components/SessionBar.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useNotifications, notifyFeatureUpdate } from './hooks/useNotifications.js';

export function App() {
  const { enabled: notificationsEnabled, toggle: toggleNotifications, permissionDenied } = useNotifications();

  const onFeatureUpdated = useCallback(
    (project: string, feature: string) => {
      if (notificationsEnabled) notifyFeatureUpdate(project, feature);
    },
    [notificationsEnabled],
  );

  const { projects, connected, loading } = useWebSocket({ onFeatureUpdated });

  const totalFeatures = projects.reduce((sum, p) => sum + p.features.length, 0);

  return (
    <div class="max-w-5xl mx-auto px-6 py-10">
      <header class="mb-10">
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-bold tracking-tight text-white font-sans">
            Dev Dashboard
          </h1>
          <span
            class={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
              connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
            title={connected ? 'Connected' : 'Reconnecting...'}
          />
          <div class="ml-auto relative">
            <button
              type="button"
              onClick={toggleNotifications}
              class={`p-1.5 rounded-md transition-colors ${
                notificationsEnabled
                  ? 'text-sky-400 bg-sky-500/10 hover:bg-sky-500/20'
                  : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/50'
              }`}
              title={
                permissionDenied
                  ? 'Notifications blocked — enable in browser settings'
                  : notificationsEnabled
                    ? 'Disable notifications'
                    : 'Enable notifications'
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="w-4 h-4"
              >
                {notificationsEnabled ? (
                  <path
                    fill-rule="evenodd"
                    d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6Z"
                    clip-rule="evenodd"
                  />
                ) : (
                  <path d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6Zm0 14.5a2 2 0 0 1-1.95-1.557 33.146 33.146 0 0 0 3.9 0A2 2 0 0 1 10 16.5Z" />
                )}
              </svg>
            </button>
            {permissionDenied && (
              <span class="absolute -bottom-6 right-0 text-[10px] text-amber-400 whitespace-nowrap">
                Blocked in browser
              </span>
            )}
          </div>
        </div>
        <p class="mt-1 text-sm text-slate-500 font-mono">
          {loading
            ? 'Connecting...'
            : `${projects.length} projects · ${totalFeatures} features`}
        </p>
      </header>

      {!loading && projects.length === 0 && (
        <div class="rounded-lg bg-slate-800/50 border border-slate-700/50 p-8 text-center text-slate-500">
          <p class="text-lg font-medium">No projects found</p>
          <p class="mt-1 text-sm">
            Check your scan directories in ~/.config/dev-dashboard/config.json
          </p>
        </div>
      )}

      {!loading && <SessionBar projects={projects} />}

      <div class="space-y-6">
        {projects.map((project, i) => (
          <div class="card-enter" style={{ animationDelay: `${i * 80}ms` }}>
            <ProjectCard project={project} />
          </div>
        ))}
      </div>
    </div>
  );
}
