import * as authService from '../services/auth.service.js';

// The same shape as task.controller.js: read the request, call one service
// function, pick the success status code. No try/catch — Express 5 forwards a
// rejected promise to the error handler, which is the single place that turns an
// HttpError into a JSON response.

export const signUp = async (req, res) => {
  // 201 Created, because a signup that worked has left something new behind.
  res.status(201).json(await authService.signUp(req.body));
};

export const logIn = async (req, res) => {
  // 200, not 201. Logging in creates a session, but the client is asking for a
  // token rather than for a resource at a new address.
  res.json(await authService.logIn(req.body));
};
