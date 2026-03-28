#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('.', import.meta.url).pathname, '..');
const changelogPath = resolve(repoRoot, 'CHANGELOG.md');
const localStart = '<!-- LOCAL-RELEASES-START -->';
const localEnd = '<!-- LOCAL-RELEASES-END -->';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/extract-local-release-notes.mjs <version>');
  process.exit(1);
}

const tag = version.startsWith('v') ? version : `v${version}`;
const changelog = readFileSync(changelogPath, 'utf8');
const start = changelog.indexOf(localStart);
const end = changelog.indexOf(localEnd);

if (start === -1 || end === -1 || end < start) {
  console.error('Missing local changelog markers.');
  process.exit(1);
}

const localSection = changelog.slice(start + localStart.length, end).trim();
const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const entryRegex = new RegExp(
  `## ${escapedTag} - .*?\\n\\n([\\s\\S]*?)(?=\\n## v\\d|$)`,
);
const match = localSection.match(entryRegex);

if (!match) {
  console.error(`No local changelog entry found for ${tag}.`);
  process.exit(1);
}

process.stdout.write(match[1].trim() + '\n');
