// The last two stops for every request: "not found", and turning a thrown error into a response.
// Express 5 passes any error thrown in a handler (including a rejected await) to errorHandler,
// so controllers simply `throw new HttpError(...)` and never write try/catch for it.
import multer from 'multer';
import config from '../config/index.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Express recognises an error handler by its four arguments, so `next` stays although unused
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  // A problem with an uploaded file (too big, too many) is the sender's mistake
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: error.message });
  }

  // Malformed JSON in the request body
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON' });
  }

  // A value longer than its database column. Controllers should check lengths first; this is the
  // net for one that was missed, so the answer is "too long" rather than "the server broke".
  if (error.code === 'ER_DATA_TOO_LONG') {
    const column = /column '([^']+)'/.exec(error.message)?.[1] ?? 'A value';
    return res.status(400).json({ error: `${column.replace(/_/g, ' ')} is too long` });
  }

  const status = error.status ?? 500;
  // A 4xx is routine (the client was told no); only our own failures deserve a stack trace
  if (status >= 500) console.error(error);

  // In production a 500's real message could reveal table names or file paths, so it is hidden
  const message = status >= 500 && config.isProduction ? 'Internal server error' : error.message;
  res.status(status).json({ error: message });
}
