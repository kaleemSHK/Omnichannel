import { isDemoDataEnabled } from '@/lib/demo/config';

/** Use demo fixture only when demo mode is on; otherwise call the real tenant API. */
export async function withDemoOnly<T>(demoData: T, fetcher: () => Promise<T>): Promise<T> {
  if (isDemoDataEnabled()) return demoData;
  return fetcher();
}
