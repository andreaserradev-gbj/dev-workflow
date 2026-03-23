import { useState, useEffect } from 'preact/hooks';
import type { Project, ProjectsResponse } from '@shared/types.js';
import { ProjectCard } from './components/ProjectCard.js';
import { STATUS_ORDER } from '@shared/types.js';

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ProjectsResponse>;
      })
      .then((data) => {
        // Sort features within each project by status priority
        for (const project of data.projects) {
          project.features.sort((a, b) =>
            (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
          );
        }
        setProjects(data.projects);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const totalFeatures = projects.reduce((sum, p) => sum + p.features.length, 0);

  return (
    <div class="max-w-5xl mx-auto px-6 py-10">
      <header class="mb-10">
        <h1 class="text-3xl font-bold tracking-tight text-white font-sans">
          Dev Dashboard
        </h1>
        <p class="mt-1 text-sm text-slate-500 font-mono">
          {loading
            ? 'Loading...'
            : error
              ? `Error: ${error}`
              : `${projects.length} projects · ${totalFeatures} features`}
        </p>
      </header>

      {error && (
        <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
          Failed to load projects: {error}
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div class="rounded-lg bg-slate-800/50 border border-slate-700/50 p-8 text-center text-slate-500">
          <p class="text-lg font-medium">No projects found</p>
          <p class="mt-1 text-sm">
            Check your scan directories in ~/.config/dev-dashboard/config.json
          </p>
        </div>
      )}

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
