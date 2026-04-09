# Configure setPrototypeShareBaseUrl

## Overview

Add `setPrototypeShareBaseUrl` to the editor options in both Forge and Connect platforms.

## Implementation

### Phase 1: Forge EditorIntegration.js
- **Status**: `[x]` done
- **File**: `packages/forge/ui/edit-modal/src/utils/EditorIntegration.js`
- **Change**: After `setBaisOptions` block, add guarded `setPrototypeShareBaseUrl` call

### Phase 2: Connect Jira EditorUtils.js
- **Status**: `[x]` done
- **File**: `packages/connect/src/jira/js/EditorUtils.js`
- **Change**: Add `shareUrls`/`shareURL` declarations + guarded call

### Phase 3: Connect Confluence EditorUtils.js
- **Status**: `[ ]` pending
- **File**: `packages/connect/src/confluence/js/EditorUtils.js`
- **Change**: Same as Jira but with `confluenceCloud` platform
