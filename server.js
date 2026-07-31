import app from './src/app.js';
import { PORT } from './src/config.js';
import { initDatabase } from './src/db/index.js';

// The entry point does two things: get the database ready, then start listening.
// Everything about what the server *is* lives in src/ — see the "Project layout"
// section of the README for the layers and which file owns what.
//
// The await is the whole point of the order. The port opens only after the table
// exists and the seeds are in, so there is no window in which the API is
// reachable but the database behind it is not ready.

await initDatabase();

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
});
