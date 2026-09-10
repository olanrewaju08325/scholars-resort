import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Enhanced lazy loading wrapper that handles network hiccups and dynamic chunk hash mismatches
 * (which occur when a new version of the application is deployed to production while users have active tabs).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | { [key: string]: any }>,
  componentName: string = 'Component'
): LazyExoticComponent<T> {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = Boolean(
      window.sessionStorage.getItem(`retry_lazy_refresh_${componentName}`)
    );

    try {
      const component = await componentImport();
      // Reset refresh state on successful load
      if (pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.removeItem(`retry_lazy_refresh_${componentName}`);
      }
      if ('default' in component) {
        return component as { default: T };
      }
      return { default: (component as any)[componentName] || Object.values(component)[0] } as { default: T };
    } catch (error: any) {
      console.warn(`[lazyWithRetry] Initial load failed for ${componentName}, attempting retry...`, error);

      // Attempt immediate retry after 800ms
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const component = await componentImport();
        if (pageHasAlreadyBeenForceRefreshed) {
          window.sessionStorage.removeItem(`retry_lazy_refresh_${componentName}`);
        }
        if ('default' in component) {
          return component as { default: T };
        }
        return { default: (component as any)[componentName] || Object.values(component)[0] } as { default: T };
      } catch (retryError: any) {
        console.error(`[lazyWithRetry] Retry failed for ${componentName}. Inspecting error type...`, retryError);

        const errorMsg = String(retryError?.message || error?.message || '').toLowerCase();
        const isChunkLoadError =
          errorMsg.includes('dynamically imported module') ||
          errorMsg.includes('failed to fetch dynamically imported module') ||
          errorMsg.includes('loading chunk') ||
          errorMsg.includes('mime type') ||
          errorMsg.includes('import call failed') ||
          retryError?.name === 'ChunkLoadError';

        if (isChunkLoadError && !pageHasAlreadyBeenForceRefreshed) {
          console.log(`[lazyWithRetry] Chunk hash mismatch detected for ${componentName}. Refreshing application to fetch latest deployment...`);
          window.sessionStorage.setItem(`retry_lazy_refresh_${componentName}`, 'true');

          // Attempt to clean old caches if supported
          if ('caches' in window) {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            } catch (_) {}
          }

          // Reload page to fetch updated index.html with new asset hashes
          window.location.reload();
          // Return a pending promise while page reloads
          return new Promise(() => {}) as any;
        }

        // Rethrow if already force-refreshed or not a chunk error
        throw retryError;
      }
    }
  });
}
