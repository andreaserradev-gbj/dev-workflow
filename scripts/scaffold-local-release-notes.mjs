#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('.', import.meta.url).pathname, '..');
const changelogPath = resolve(repoRoot, 'CHANGELOG.md');
const marketplacePath = resolve(repoRoot, '.claude-plugin/marketplace.json');
const localStart = '<!-- LOCAL-RELEASES-START -->';
const localEnd = '<!-- LOCAL-RELEASES-END -->';

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function getMarketplaceVersion() {
  const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
  return marketplace.plugins?.[0]?.version ?? '0.0.0';
}

const requestedVersion = process.argv[2];
const version = requestedVersion ?? getMarketplaceVersion();
const tag = `v${version}`;
const today = new Date().toISOString().slice(0, 10);
const previousTag = run('git', ['describe', '--tags', '--abbrev=0']);

const existing = readFileSync(changelogPath, 'utf8');
if (existing.includes(`## ${tag} - `)) {
  process.exit(0);
}

const commits = run('git', ['log', `${previousTag}..HEAD`, '--pretty=format:%s'])
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const bullets = commits.length > 0 ? commits.map((line) => `- ${line}`).join('\n') : '- Describe changes here.';

const entry = `## ${tag} - ${today}

### Changed

${bullets}`;

const start = existing.indexOf(localStart);
const end = existing.indexOf(localEnd);
if (start === -1 || end === -1 || end < start) {
  throw new Error('Missing local changelog markers.');
}

const before = existing.slice(0, start + localStart.length);
const localBody = existing.slice(start + localStart.length, end).trim();
const after = existing.slice(end);
const nextLocalBody = localBody ? `${entry}\n\n${localBody}` : entry;
const next = `${before}\n\n${nextLocalBody}\n\n${after}`;

writeFileSync(changelogPath, next);
