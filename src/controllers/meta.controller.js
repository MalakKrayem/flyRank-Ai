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

export const health = (req, res) => {
  res.json({ status: 'ok' });
};

export const stats = (req, res) => {
  res.json(taskService.stats());
};

export const reset = (req, res) => {
  res.json(taskService.reset());
};

export const openapi = (req, res) => {
  res.json(openapiSpec);
};
