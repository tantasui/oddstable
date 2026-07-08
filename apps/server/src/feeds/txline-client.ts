// Shared TxLINE API credentials and base fetch.
// All data endpoints require BOTH the JWT bearer token AND the X-Api-Token header.

export function txlineOrigin(): string {
  return process.env.TXLINE_ORIGIN ?? 'https://txline-dev.txodds.com';
}

export function txlineHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.TXLINE_JWT ?? ''}`,
    'X-Api-Token': process.env.TXLINE_API_TOKEN ?? '',
    'Accept-Encoding': 'gzip',
    Accept: 'application/json',
  };
}

export async function txlineFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${txlineOrigin()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...txlineHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TxLINE ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}
