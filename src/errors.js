// The service layer has to be able to say "this input is wrong" or "that task
// does not exist" without knowing what an HTTP status code is. It throws one of
// these instead, and the error middleware is the single place that turns them
// into responses.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const badRequest = (message) => new HttpError(400, message);

// 401 is "I do not know who you are" — no token, a broken one, or credentials
// Supabase rejected. It is not 403, which is "I know exactly who you are, and you
// still may not." Nothing in this file distinguishes them; the caller does, by
// picking one.
export const unauthorized = (message) => new HttpError(401, message);

export const notFound = (message) => new HttpError(404, message);
