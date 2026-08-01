import express from 'express';
import swaggerUi from 'swagger-ui-express';
import taskRoutes from './routes/task.routes.js';
import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public.routes.js';
import protectedRoutes from './routes/protected.routes.js';
import metaRoutes from './routes/meta.routes.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { openapiSpec } from './openapi.js';

// Assembles the application out of the layers and hands it back unstarted.
// Keeping "what the app is" separate from "start listening on a port" is what
// lets a test import the app directly, and what keeps server.js down to two
// lines.
//
// The order below is the order a request travels in: parse the body, try the
// routes, fall through to a 404 if none matched, and — if anything threw on the
// way — end at the error handler. The error handler is last on purpose. Express
// only reaches an error handler that is registered after the thing that failed,
// so one at the very end catches everything, including the malformed-JSON error
// from express.json() above it.

const app = express();

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'Task API — docs' }));

app.use('/auth', authRoutes);
app.use('/public', publicRoutes);
app.use('/protected', protectedRoutes);
app.use('/tasks', taskRoutes);
app.use('/', metaRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
