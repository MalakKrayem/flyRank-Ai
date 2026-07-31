import { HttpError } from '../errors.js';

// The one place that turns a thrown error into a response. Because it sits at the
// end of the stack, every error reaches it: the ones the service throws on
// purpose, the ones express.json() throws on a malformed body, and the ones
// nobody meant to throw at all.
//
// Express recognises this as an error handler by its four arguments — `next` is
// unused and still has to be declared.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // express.json() throws this on an unparseable body. Without the check the
  // client would get Express's default HTML error page, which would break the
  // promise that every error is JSON.
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Anything reaching here is a bug rather than a bad request. It gets logged in
  // full and answered with a generic message, because an internal error's text
  // can carry details a client has no business seeing.
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
