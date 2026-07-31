import { readFileSync } from 'node:fs';
import { OPENAPI_FILE } from './config.js';

// Read once at startup rather than on every request. The spec is a file on disk
// that only changes when the project does, so re-reading it per request would be
// work with no possible new answer — but it does mean an edit to openapi.json
// needs a server restart to show up at /docs.
export const openapiSpec = JSON.parse(readFileSync(OPENAPI_FILE));
