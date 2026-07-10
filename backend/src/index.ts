import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { apiRouter } from './routes/api.js';
import { queueWorker } from './worker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    worker: 'running',
    mode: process.env.MOCK_EVOLUTION_API === 'true' ? 'MOCK' : 'LIVE',
  });
});

// Serve frontend static build if available
const frontendDist = path.join(process.cwd(), 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Start Server & Worker
app.listen(PORT, () => {
  console.log(`===================================================================`);
  console.log(`🚀 ROPMITRA WHATSAPP OUTREACH AUTOMATION SERVER READY`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`🤖 Evolution API Mode: ${process.env.MOCK_EVOLUTION_API === 'true' ? 'MOCK (Simulated)' : process.env.EVOLUTION_API_URL}`);
  console.log(`===================================================================`);
  queueWorker.start();
});
