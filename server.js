import app from './src/app.js';
import { PORT } from './src/config.js';

// The entry point does one thing: start listening. Everything about what the
// server *is* lives in src/ — see the "Project layout" section of the README for
// the layers and which file owns what.

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
});
