/** "Chrome on Windows" from a user agent string; good enough for a sign-in list. */
export function describeDevice(userAgent: string): string {
  const ua = userAgent || '';
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /curl|node|axios|python|Postman/i.test(ua) ? 'Script'
    : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser} on ${os}` : browser;
}
