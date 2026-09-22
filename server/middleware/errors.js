import multer from "multer";
import { isProduction } from "../config.js";

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

  console.error(error);
  const status = error.status ?? 500;
  res.status(status).json({
    error: isProduction && status === 500 ? "Internal server error" : error.message,
  });
}
