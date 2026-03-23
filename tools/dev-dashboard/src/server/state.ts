import type { Feature, FeatureDetail, Phase, Project, SubPrd } from '../shared/types.js';
import { STATUS_ORDER } from '../shared/types.js';

/** Sort features by status priority, then projects by most recently active. Pure function. */
export function sortProjects(projects: Project[]): Project[] {
  return projects
    .map((p) => ({
      ...p,
      features: [...p.features].sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      ),
    }))
    .sort((a, b) => {
      const latestCheckpoint = (proj: Project): number => {
        let max = 0;
        for (const f of proj.features) {
          if (f.lastCheckpoint) {
            const t = new Date(f.lastCheckpoint).getTime();
            if (t > max) max = t;
          }
        }
        return max;
      };
      return latestCheckpoint(b) - latestCheckpoint(a);
    });
}

export class DashboardState {
  private projects = new Map<string, Project>();

  setProjects(projects: Project[]): void {
    this.projects.clear();
    for (const project of projects) {
      this.projects.set(project.path, project);
    }
  }

  getProjects(): Project[] {
    return sortProjects(Array.from(this.projects.values()));
  }

  getProject(nameOrPath: string): Project | null {
    // Try by path first
    const byPath = this.projects.get(nameOrPath);
    if (byPath) return byPath;

    // Fall back to name match
    for (const project of this.projects.values()) {
      if (project.name === nameOrPath) return project;
    }
    return null;
  }

  getFeature(projectName: string, featureName: string): Feature | null {
    const project = this.getProject(projectName);
    if (!project) return null;
    return project.features.find((f) => f.name === featureName) ?? null;
  }

  updateFeature(projectPath: string, featureName: string, data: Partial<Feature>): void {
    const project = this.projects.get(projectPath);
    if (!project) return;

    const idx = project.features.findIndex((f) => f.name === featureName);
    if (idx === -1) return;

    project.features[idx] = { ...project.features[idx], ...data };
  }

  addFeature(projectPath: string, feature: Feature): void {
    const project = this.projects.get(projectPath);
    if (project) {
      const existing = project.features.findIndex((f) => f.name === feature.name);
      if (existing === -1) {
        project.features.push(feature);
      } else {
        project.features[existing] = feature;
      }
    } else {
      // New project discovered via watcher
      const name = projectPath.split('/').pop() ?? projectPath;
      this.projects.set(projectPath, {
        name,
        path: projectPath,
        features: [feature],
      });
    }
  }

  removeFeature(projectPath: string, featureName: string): void {
    const project = this.projects.get(projectPath);
    if (!project) return;

    project.features = project.features.filter((f) => f.name !== featureName);
    if (project.features.length === 0) {
      this.projects.delete(projectPath);
    }
  }

  get projectCount(): number {
    return this.projects.size;
  }

  get featureCount(): number {
    let count = 0;
    for (const project of this.projects.values()) {
      count += project.features.length;
    }
    return count;
  }
}
