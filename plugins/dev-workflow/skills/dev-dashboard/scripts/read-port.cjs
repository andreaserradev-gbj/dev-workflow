#!/usr/bin/env node
'use strict';

// Read and validate the `port` field from the dev-dashboard config file.
//
// Invoked by start.sh as:  node read-port.cjs <config-path>
//
// Prints the port to stdout only when it is a valid integer in (0, 65535];
// otherwise prints nothing and exits 0, so the caller falls back to its
// default port. Committed as a real file (not generated/eval'd at runtime)
// so the launch path carries no dynamic-code-execution surface.

const fs = require('fs');

const configPath = process.argv[2];

try {
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  const port = parsed.port;
  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    process.stdout.write(String(port));
  }
} catch {
  // Missing / unreadable / invalid-JSON config — emit nothing; the caller
  // (start.sh) treats an empty result as "use the default port".
}
