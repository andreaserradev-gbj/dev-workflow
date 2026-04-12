#!/usr/bin/env node

// dev-workflow-cli — agent-first CLI over the shared workflow core
//
// Usage: dev-workflow <command> [options]
//
// Commands:
//   feature-show       Show feature summary (status, progress, phase, checkpoint)
//   progress-summary   Show aggregate progress across phases/sub-PRDs
//   gate-check         Check if a feature is at a phase gate
//   checkpoint-read    Read and display checkpoint data

import { featureShow } from './commands/feature-show.js';
import { progressSummary } from './commands/progress-summary.js';
import { gateCheck } from './commands/gate-check.js';
import { checkpointRead } from './commands/checkpoint-read.js';
import { checkpointWrite } from './commands/checkpoint-write.js';
import { statusUpdate } from './commands/status-update.js';
import { resumeContext } from './commands/resume-context.js';

interface Command {
  name: string;
  description: string;
  run: (args: string[]) => Promise<number>;
}

const commands: Command[] = [
  { name: 'feature-show', description: 'Show feature summary', run: featureShow },
  { name: 'progress-summary', description: 'Show aggregate progress', run: progressSummary },
  { name: 'gate-check', description: 'Check if feature is at a phase gate', run: gateCheck },
  { name: 'checkpoint-read', description: 'Read checkpoint data', run: checkpointRead },
  { name: 'checkpoint-write', description: 'Write checkpoint from stdin JSON (+session-log)', run: checkpointWrite },
  { name: 'status-update', description: 'Update PRD status marker', run: statusUpdate },
  { name: 'resume-context', description: 'Merged resume context packet', run: resumeContext },
];

function printUsage(): void {
  console.log('Usage: dev-workflow <command> [options]\n');
  console.log('Commands:');
  for (const cmd of commands) {
    console.log(`  ${cmd.name.padEnd(20)} ${cmd.description}`);
  }
  console.log('\nOptions:');
  console.log('  --json               Output as JSON');
  console.log('  --dir <path>         Feature directory');
  console.log('  --feature <name>     Feature name under .dev/');
  console.log('  --stdin              Read input from stdin (checkpoint-write)');
  console.log('  --phase <number>     Phase number (status-update)');
  console.log('  --step <number>      Step number (status-update)');
  console.log('  --marker <done|todo> Marker value (status-update)');
  console.log('  --sessions <N|all>   Session history limit (resume-context, default: 5)');
}

export function parseFlags(args: string[]): { flags: Record<string, string | true>; positional: string[] } {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        // Handle --flag=value syntax
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        flags[key] = value || true;
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    return args.length === 0 ? 1 : 0;
  }

  const commandName = args[0];
  const command = commands.find((c) => c.name === commandName);

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    printUsage();
    return 1;
  }

  return command.run(args.slice(1));
}

// Only run when executed directly (not when imported by tests).
// Vitest sets this env var; the bundled CJS entry always runs directly.
if (typeof process !== 'undefined' && !process.env.VITEST) {
  main().then((code) => process.exit(code));
}
