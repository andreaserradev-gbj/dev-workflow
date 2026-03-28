#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('.', import.meta.url).pathname, '..');
const changelogPath = resolve(repoRoot, 'CHANGELOG.md');

const localStart = '<!-- LOCAL-RELEASES-START -->';
const localEnd = '<!-- LOCAL-RELEASES-END -->';
const githubStart = '<!-- GITHUB-RELEASES-START -->';
const githubEnd = '<!-- GITHUB-RELEASES-END -->';

function runGh(args) {
  return execFileSync('gh', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

function formatRelease(release) {
  const date = release.publishedAt.slice(0, 10);
  const heading = `## ${release.name || release.tagName} - ${date}`;
  const body = (release.body || '_No release notes._').trim() || '_No release notes._';
  return `${heading}\n\n${body}`;
}

function replaceSection(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Missing changelog markers: ${startMarker} / ${endMarker}`);
  }
  const before = source.slice(0, start + startMarker.length);
  const after = source.slice(end);
  return `${before}\n\n${replacement}\n\n${after}`;
}

const releases = JSON.parse(
  runGh([
    'api',
    'repos/andreaserradev-gbj/dev-workflow/releases?per_page=100',
  ]),
).map((release) => ({
  tagName: release.tag_name,
  name: release.name,
  body: release.body,
  publishedAt: release.published_at,
}));

const generated = releases.map(formatRelease).join('\n\n');
const current = readFileSync(changelogPath, 'utf8');
const next = replaceSection(current, githubStart, githubEnd, generated);

if (next !== current) {
  writeFileSync(changelogPath, next);
}
