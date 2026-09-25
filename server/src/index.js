// Starts the server. `npm run dev` runs this with --watch, so saving a server file restarts it.
import app from './app.js';
import config from './config/index.js';

app.listen(config.port, () => {
  console.log(`LMS running at http://localhost:${config.port}`);
});
