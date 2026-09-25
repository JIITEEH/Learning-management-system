// Builds the Express app: every request passes through these steps, top to bottom.
// index.js starts it listening; keeping the two apart lets tests use the app without a port.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import config from './config/index.js';
import routes from './api-endpoints/index.js';
import { currentUser } from './request-filters/auth.js';
import { errorHandler, notFound } from './request-filters/errorHandler.js';
import { sameOriginOnly, securityHeaders } from './request-filters/securityHeaders.js';

const app = express();

// "X-Powered-By: Express" only tells attackers which framework's weaknesses to try
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(securityHeaders);

// Only JSON bodies are read. A plain HTML form (the kind another website can submit on a
// visitor's behalf) therefore arrives with nothing the API will act on.
app.use(express.json());

// Sessions: the browser holds only a random id in a cookie; who it belongs to stays on the server
app.use(
  session({
    name: 'lms.sid',
    secret: config.sessionSecret,
    resave: false, // don't rewrite a session that did not change
    saveUninitialized: false, // no cookie at all until someone signs in
    cookie: {
      httpOnly: true, // page scripts cannot read it, so an injected script cannot steal it
      sameSite: 'lax', // not sent with requests that other websites start
      secure: config.isProduction, // HTTPS only, once live
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  }),
);
app.use(currentUser);

app.use('/api', sameOriginOnly, routes);
app.use('/api', notFound);

// The web pages. Until the React client replaces them, these are the plain HTML pages in public/.
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
app.use(express.static(publicDir));
app.use((req, res) => res.status(404).sendFile(path.join(publicDir, 'pages/404.html')));

app.use(errorHandler);

export default app;
