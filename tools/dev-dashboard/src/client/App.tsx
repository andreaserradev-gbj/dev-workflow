import { ProjectCard } from './components/ProjectCard.js';
import { SessionBar } from './components/SessionBar.js';
import { useWebSocket } from './hooks/useWebSocket.js';

export function App() {
  const { projects, connected, loading } = useWebSocket();

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
