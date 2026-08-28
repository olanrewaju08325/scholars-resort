import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Ensure the route prefix matches Express routes if stripped by rewrites
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/index')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req as any, res as any);
}
