import multer from "multer";
import { isProduction } from "../config.js";

/**
 * An error carrying an HTTP status. `errorHandler` below reads `status`, so
 * a route can `throw httpError(409, "Email already registered")` and get the
 * right response without assembling one itself.
 */
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Express 4 does not catch a rejected promise from a handler, so every async
 * route is wrapped in this. Without it a failed query hangs the request
 * instead of reaching `errorHandler`.
 */
export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFound(req, res) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.status(404).sendFile("pages/404.html", { root: "public" });
}

// Express identifies an error handler by its four arguments, so `_next`
// stays even though it is unused.
export function errorHandler(error, req, res, _next) {
  // Upload failures are the client's fault, not a server fault.
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ error: error.message, code: error.code });
  }

  // A value longer than its database column. Every form field should be
  // checked before it gets this far; this is the net for one that was
  // missed, so it answers "too long" rather than "the server broke".
  if (error.code === "ER_DATA_TOO_LONG") {
    const column = /column '([^']+)'/.exec(error.message)?.[1] ?? "A value";
    return res.status(400).json({ error: `${column.replace(/_/g, " ")} is too long` });
  }

  const status = error.status ?? 500;

  // A 4xx is the client being told no, which is routine — only a fault on
  // our side is worth a stack trace in the log.
  if (status >= 500) console.error(error);

  res.status(status).json({
    error: isProduction && status === 500 ? "Internal server error" : error.message,
  });
}
