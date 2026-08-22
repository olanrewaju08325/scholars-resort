import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiUrl(path: string): string {
  if (!path.startsWith('/api')) return path;
  
  // If a custom backend URL is explicitly configured via environment variables, use it
  const customBackend = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_BACKEND_URL;
  if (customBackend && typeof customBackend === 'string' && customBackend.trim().startsWith('http')) {
    return `${customBackend.trim().replace(/\/$/, '')}${path}`;
  }
  
  return path;
}
