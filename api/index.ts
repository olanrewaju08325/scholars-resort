import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return new Promise<void>((resolve) => {
    // Ensure the Serverless Function lifecycle waits for Express to finish streaming the response
    res.on('finish', () => resolve());
    res.on('close', () => resolve());

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
        const forwardedUri = (
          req.headers['x-forwarded-uri'] || 
          req.headers['x-original-url'] || 
          req.headers['x-matched-path'] || 
          req.headers['x-vercel-original-url']
        ) as string;
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

      // If Vercel already parsed the request body, flag it so body-parser does not hang
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        (req as any)._body = true;
      }

      // Delegate request processing to the Express application
      app(req as any, res as any, (err: any) => {
        if (err) {
          console.error('[Vercel Express Uncaught Error]', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: err?.message || 'Internal Server Error in Serverless Handler',
              timestamp: new Date().toISOString()
            });
          }
        }
        resolve();
      });
    } catch (err: any) {
      console.error('[Vercel Serverless Function Dispatcher Error]', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: err?.message || 'Internal Server Error in Serverless Function Dispatcher',
          timestamp: new Date().toISOString()
        });
      }
      resolve();
    }
  });
}
