import express from 'express';
import http from 'http';
import path from 'path';
import app from './api/index';
import { setupStudyRoomWebSocket } from './src/services/studyRoomSocketServer';
import { startTournamentReminderWorker } from './src/services/tournamentReminderWorker';

const PORT = 3000;

async function startServer() {
  const httpServer = http.createServer(app);

  // Setup WebSocket server for Peer Study Rooms
  setupStudyRoomWebSocket(httpServer);

  // Start background worker for upcoming tournament email alerts
  startTournamentReminderWorker(60000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running with WebSocket study room support on http://0.0.0.0:${PORT}`);
  });
}

// Only launch standalone listener in long-running container or local dev environments
const isVercelRuntime = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (!isVercelRuntime) {
  startServer();
}

export default app;
export { app };
