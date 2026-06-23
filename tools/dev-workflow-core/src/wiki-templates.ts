import type { Project } from './types.js';
import { STATUS_ORDER } from './types.js';

export function buildIndexPage(projects: Project[], generated: string): string {
  let totalFeatures = 0;
  for (const p of projects) totalFeatures += p.features.length;

  const lines: string[] = [
    '---',
    `generated: "${generated}"`,
    `projects: ${projects.length}`,
    `features: ${totalFeatures}`,
    '---',
    '',
    '# Dev Wiki Index',
    '',
  ];

  if (projects.length === 0) {
    lines.push('*No projects found.*');
    return lines.join('\n') + '\n';
  }

  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));

  for (const project of sorted) {
    const activeFeatures = project.features.filter((f) => f.status !== 'archived');
    const archivedFeatures = project.features.filter((f) => f.status === 'archived');

    lines.push(`## ${project.name} (${project.features.length} features)`);
    lines.push('');

    if (activeFeatures.length > 0) {
      const sortedActive = [...activeFeatures].sort((a, b) => {
        const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;
        return compareDatesDesc(a.lastCheckpoint, b.lastCheckpoint);
      });

      lines.push('| Feature | Status | Progress | Summary | Tags |');
      lines.push('|---------|--------|----------|---------|------|');
      for (const f of sortedActive) {
        const link = `[${f.name}](projects/${project.name}/${f.name}/00-master-plan.md)`;
        const progress = f.progress
          ? `${f.progress.done}/${f.progress.total} (${f.progress.percent}%)`
          : '—';
        const summary = truncate(f.summary ?? '', 120);
        const tags = formatTags(f.tags);
        lines.push(`| ${link} | ${f.status} | ${progress} | ${summary} | ${tags} |`);
      }
      lines.push('');
    }

    if (archivedFeatures.length > 0) {
      const sortedArchived = [...archivedFeatures].sort((a, b) =>
        compareDatesDesc(a.lastCheckpoint, b.lastCheckpoint),
      );

      lines.push(`### Archived (${archivedFeatures.length})`);
      lines.push('');
      lines.push('| Feature | Progress | Summary | Tags |');
      lines.push('|---------|----------|---------|------|');
      for (const f of sortedArchived) {
        const link = `[${f.name}](projects/${project.name}--archive/${f.name}/00-master-plan.md)`;
        const progress = f.progress
          ? `${f.progress.done}/${f.progress.total} (${f.progress.percent}%)`
          : '—';
        const summary = truncate(f.summary ?? '', 120);
        const tags = formatTags(f.tags);
        lines.push(`| ${link} | ${progress} | ${summary} | ${tags} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n') + '\n';
}

export function buildLogPage(projects: Project[], generated: string): string {
  const allFeatures: {
    project: string;
    name: string;
    status: string;
    progress: string;
    summary: string;
    tags: string;
    date: string;
    dateRaw: string | null;
  }[] = [];

  for (const project of projects) {
    for (const f of project.features) {
      const dateRaw = f.lastCheckpoint ?? f.lastUpdated ?? null;
      const date = dateRaw ? formatDate(dateRaw) : 'unknown';
      const progress = f.progress ? `${f.progress.percent}%` : '—';
      allFeatures.push({
        project: project.name,
        name: f.name,
        status: f.status,
        progress,
        summary: truncate(f.summary ?? '', 120),
        tags: f.tags.join(', '),
        date,
        dateRaw,
      });
    }
  }

  allFeatures.sort((a, b) => compareDatesDesc(a.dateRaw, b.dateRaw));

  const lines: string[] = [
    '---',
    `generated: "${generated}"`,
    `entries: ${allFeatures.length}`,
    '---',
    '',
    '# Dev Wiki Log',
    '',
  ];

  if (allFeatures.length === 0) {
    lines.push('*No features found.*');
    return lines.join('\n') + '\n';
  }

  for (const entry of allFeatures) {
    lines.push(
      `## [${entry.date}] ${entry.project} | ${entry.name} | ${entry.status} | ${entry.progress}`,
    );
    if (entry.summary) {
      lines.push('');
      lines.push(entry.summary);
    }
    if (entry.tags) {
      lines.push('');
      lines.push(`**Tags**: ${entry.tags}`);
    }
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

export function buildReadmePage(): string {
  return `# Dev Wiki

This directory is an auto-generated wiki of all your \`.dev/\` development features across projects.

**Do not edit files here manually** — they are regenerated automatically by the dev-dashboard server.

## Opening in Obsidian

1. Open Obsidian
2. File → Open Vault → select this directory
3. Browse \`index.md\` for a cross-project overview

## Recommended Plugins

- **Dataview** — query YAML frontmatter across files (e.g., list all active features)
- **Graph View** (built-in) — visualize connections between features

## Example Dataview Query

\`\`\`dataview
TABLE status, progress
FROM ""
WHERE status = "active"
SORT progress DESC
\`\`\`

## Project Symlinks

The \`projects/\` directory contains symlinks to each project's \`.dev/\` and \`.dev-archive/\` directories. This means you can browse feature PRDs directly without copying files.
`;
}

export function buildObsidianAppConfig(): string {
  return JSON.stringify({ alwaysUpdateLinks: true, newLinkFormat: 'relative' }, null, 2) + '\n';
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

/** Render tags as plain comma-separated text for a table cell, or an em dash
 *  when there are none. Text only — no UI pills. */
function formatTags(tags: string[]): string {
  return tags.length > 0 ? tags.join(', ') : '—';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10);
}

function compareDatesDesc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(b).getTime() - new Date(a).getTime();
}
