import app from './src/app.js';
import { PORT } from './src/config.js';
import { initDatabase } from './src/db/index.js';
import { checkSupabase } from './src/auth/supabase.js';

// The entry point does two things: get the database ready, then start listening.
// Everything about what the server *is* lives in src/ — see the "Project layout"
// section of the README for the layers and which file owns what.
//
// The await is the whole point of the order. The port opens only after the table
// exists and the seeds are in, so there is no window in which the API is
// reachable but the database behind it is not ready.
//
// Supabase gets the same treatment for the same reason. A wrong URL or a missing
// key should stop the server here with one sentence, not surface an hour later as
// a confusing 500 on someone's first signup.

await initDatabase();
await checkSupabase();

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
  console.log('Connected to Supabase Auth');
});
