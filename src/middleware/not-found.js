import { notFound } from '../errors.js';

// Sits after every route, so it only runs when nothing matched. Without it an
// unknown URL falls through to Express's built-in handler, which answers with an
// HTML page — and the API promises that every error is JSON.
export const notFoundHandler = (req, res, next) => {
  next(notFound(`Cannot ${req.method} ${req.originalUrl}`));
};
