import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT) || 8000;
const host = '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`EasyList backend running on http://${host}:${port}`);
  console.log(`Health check: http://${host}:${port}/api/health`);
});

// Explicit HTTP timeouts so long-running OCR requests are never cut off by Node defaults.
// - requestTimeout bounds receiving the full request (10 MB uploads on slow mobile data).
// - headersTimeout must stay below requestTimeout.
// - keepAliveTimeout above typical proxy idle timeouts (60s) avoids reset connections.
// - server.timeout = 0 disables the socket inactivity timeout while Gemini is processing.
server.requestTimeout = 180_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 65_000;
server.timeout = 0;
