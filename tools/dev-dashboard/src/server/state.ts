import type { Feature, FeatureDetail, Phase, Project, SubPrd } from '../shared/types.js';

export class DashboardState {
  private projects = new Map<string, Project>();

  setProjects(projects: Project[]): void {
    this.projects.clear();
    for (const project of projects) {
      this.projects.set(project.path, project);
    }
  }

  getProjects(): Project[] {
    return Array.from(this.projects.values());
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
