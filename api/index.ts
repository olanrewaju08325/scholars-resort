import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let targetUrl = req.url || '/api';

    // 1. Check if Vercel passed the path via rewrite query param
    const urlObj = new URL(targetUrl, 'http://localhost');
    const vercelPath = urlObj.searchParams.get('__vercel_path') || urlObj.searchParams.get('path');

    if (vercelPath) {
      urlObj.searchParams.delete('__vercel_path');
      urlObj.searchParams.delete('path');
      const search = urlObj.searchParams.toString();
      const cleanPath = vercelPath.startsWith('/') ? vercelPath : `/${vercelPath}`;
      targetUrl = search ? `${cleanPath}?${search}` : cleanPath;
    } else {
      // If no query param, inspect headers or strip /api/index
      const forwardedUri = (req.headers['x-forwarded-uri'] || req.headers['x-original-url']) as string;
      if (forwardedUri && forwardedUri.startsWith('/api') && !forwardedUri.startsWith('/api/index')) {
        targetUrl = forwardedUri;
      } else if (targetUrl.startsWith('/api/index')) {
        const rest = targetUrl.slice('/api/index'.length);
        targetUrl = rest ? (rest.startsWith('/') ? `/api${rest}` : `/api/${rest}`) : '/api';
      } else if (targetUrl.startsWith('/index')) {
        const rest = targetUrl.slice('/index'.length);
        targetUrl = rest ? (rest.startsWith('/') ? `/api${rest}` : `/api/${rest}`) : '/api';
      } else if (!targetUrl.startsWith('/api')) {
        targetUrl = `/api${targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`}`;
      }
    }

    req.url = targetUrl;
    (req as any).originalUrl = targetUrl;
    (req as any).baseUrl = '';

    if (req.query) {
      delete (req.query as any).__vercel_path;
      delete (req.query as any).path;
    }

    return app(req as any, res as any);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Handler Error]', err);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Internal Server Error in Serverless Function Dispatcher',
        timestamp: new Date().toISOString()
      });
    }
  }
}

