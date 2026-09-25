// Builds the Express app: every request passes through these steps, top to bottom.
// index.js starts it listening; keeping the two apart lets tests use the app without a port.
import fs from 'node:fs';
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
// visitor's behalf) therefore arrives with nothing the API will act on. 256 KB fits the longest
// lesson (50,000 characters, up to 3 bytes each) with room to spare; the default 100 KB did not.
app.use(express.json({ limit: '256kb' }));

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

// The screens. Every address outside /api is one the React app draws itself (/courses/7, say),
// so each gets the same index.html and the app picks the screen from the address.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const SCREEN_ADDRESS = /^\/(?!api(\/|$)).*/;
if (fs.existsSync(clientDist)) {
  // After `npm run build`: the finished screens, served by this server
  app.use(express.static(clientDist));
  app.get(SCREEN_ADDRESS, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else if (!config.isProduction) {
  // In development the screens come from Vite on port 5174 (see client/vite.config.js), so a page
  // opened here, such as a reset link from an email, is sent on there
  app.get(SCREEN_ADDRESS, (req, res) => res.redirect(`http://localhost:5174${req.originalUrl}`));
}

app.use(notFound);
app.use(errorHandler);

export default app;
