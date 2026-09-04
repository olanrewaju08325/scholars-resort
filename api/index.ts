import type { VercelRequest, VercelResponse } from '@vercel/node';

let appInstance: any = null;
let initError: any = null;

async function getOrInitApp() {
  if (appInstance) return appInstance;
  if (initError) throw initError;

  try {
    const mod = await import('../server');
    appInstance = mod.default || mod.app;
    return appInstance;
  } catch (err: any) {
    initError = err;
    console.error('[Vercel Lambda Init Error]', err);
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getOrInitApp();
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Handler Crash]', err);
    return res.status(500).json({
      success: false,
      error: 'SERVERLESS_MODULE_INIT_FAILED',
      message: err?.message || String(err),
      name: err?.name,
      stack: err?.stack ? err.stack.split('\n').slice(0, 15) : undefined,
    });
  }
}
