import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import shopRoutes from './routes/shopRoutes.js';
import authRoutes from './routes/authRoutes.js';
import ocrRoutes from './routes/ocrRoutes.js';

const app = express();

const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const firebaseHostingPattern = /^https:\/\/easylist-[a-z0-9-]+\.(web\.app|firebaseapp\.com)$/;
const vercelHostingPattern = /^https:\/\/easylist[a-z0-9-]*\.vercel\.app$/;

const allowedOrigins = [
  'https://easylist-588d9.web.app',
  'https://easylist-588d9.firebaseapp.com',
  'https://easylist-d1553.web.app',
  'https://easylist-d1553.firebaseapp.com',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}

function isOriginAllowed(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true;
  if (localOriginPattern.test(origin)) return true;
  if (firebaseHostingPattern.test(origin)) return true;
  if (vercelHostingPattern.test(origin)) return true;
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/ocr', ocrRoutes);

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'EasyList backend is running',
    timestamp: new Date().toISOString(),
  });
});

export default app;
