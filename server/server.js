import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";

import { config, isProduction } from "./config.js";
import apiRoutes from "./routes/index.js";
import { currentUser } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "lms.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use(currentUser);

// JSON API first, then the static pages it serves data to.
app.use("/api", apiRoutes);
app.use(express.static(publicDir));

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`LMS running at http://localhost:${config.port}`);
});
