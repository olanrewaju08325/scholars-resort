import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiUrl(path: string): string {
  if (!path.startsWith('/api')) return path;
  
  const origin = window.location.origin;
  // If we are hosted on Vercel, direct all server API calls to the production Cloud Run backend
  if (origin.includes('vercel.app')) {
    return `https://ais-pre-ity2upo7enzaao2otb7fcf-761006180903.europe-west2.run.app${path}`;
  }
  return path;
}
