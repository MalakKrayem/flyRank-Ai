import * as taskService from '../services/task.service.js';
import { openapiSpec } from '../openapi.js';

// The endpoints that describe or operate on the service itself rather than on
// tasks: what this API is, whether it is alive, how many tasks there are, and the
// reset button that puts the three examples back.

export const describe = (req, res) => {
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks'],
    docs: '/docs',
  });
};

// A liveness check that actually checks something. Answering `{"status":"ok"}`
// from the process alone only ever proved that Node was running — and an API that
// cannot reach its database is not "up", it is a 500 waiting for its first
// visitor. So this one runs a real SELECT 1 and reports what came back.
//
// This is the endpoint a load balancer or an orchestrator polls, and it is why
// the shape matters: a 200 means "send me traffic", anything else means "take me
// out of rotation and try the next instance". Getting it wrong in either
// direction is a bad day — a check that never fails keeps routing users to a
// broken instance; a check that fails on a hiccup pulls a healthy one offline.
//
// The failure path is deliberately not thrown. An error would reach the error
// handler and become a 500, and a 500 is the answer to "your request broke us",
// not to "we are unwell and honestly reporting it". 503 says the difference.
export const health = async (req, res) => {
  try {
    await taskService.checkDatabase();
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'unreachable', error: err.message });
  }
};

export const stats = async (req, res) => {
  res.json(await taskService.stats());
};

export const reset = async (req, res) => {
  res.json(await taskService.reset());
};

export const openapi = (req, res) => {
  res.json(openapiSpec);
};
