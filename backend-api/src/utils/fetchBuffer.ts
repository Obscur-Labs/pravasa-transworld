import https from 'https';
import http from 'http';

/** Downloads a remote asset (Cloudinary upload, …) into memory, following a few redirects. */
export async function fetchBuffer(url: string, redirectsLeft = 3): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https://') ? https : http;
    const chunks: Buffer[] = [];
    const req = protocol.get(url, (res) => {
      const { statusCode = 0, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(fetchBuffer(new URL(headers.location, url).toString(), redirectsLeft - 1));
        return;
      }
      if (statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${statusCode}`)); return; }
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}
