import { resolve } from 'path';

/**
 * Resolve the feature directory from CLI flags.
 *
 * Accepts either:
 *   --dir <absolute-or-relative-path>   Direct path to feature directory
 *   --feature <name>                    Feature name under .dev/ in CWD
 */
export function resolveFeatureDir(flags: Record<string, string | true>): string | null {
  if (typeof flags.dir === 'string') {
    return resolve(flags.dir);
  }

  if (typeof flags.feature === 'string') {
    return resolve(process.cwd(), '.dev', flags.feature);
  }

  return null;
}
