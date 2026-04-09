// Re-export all scanner functionality from the shared workflow core.
// The core is the single owner of .dev/ project scanning semantics.
export { scanProjects } from 'dev-workflow-core';
export type { ScanOptions } from 'dev-workflow-core';
