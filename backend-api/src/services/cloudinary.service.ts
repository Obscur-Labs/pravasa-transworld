import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { fetchBuffer } from '../utils/fetchBuffer';

type ResourceType = 'image' | 'raw' | 'auto';

/**
 * `private: true` stores the file as an authenticated asset: it can only be fetched
 * through a signed, expiring URL from deliveryUrl(). Use it for anything personal
 * (passports, KYC, visas). Public uploads are for site content only.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: ResourceType = 'auto',
  opts: { private?: boolean } = {}
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, type: opts.private ? 'authenticated' : 'upload' },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

export async function deleteFromCloudinary(publicId: string, storedUrl?: string): Promise<void> {
  const asset = storedUrl ? parseAssetUrl(storedUrl) : null;
  await cloudinary.uploader.destroy(publicId, {
    resource_type: asset?.resourceType || 'image',
    type: asset?.type || 'upload',
    invalidate: true,
  });
}

interface AssetInfo {
  resourceType: 'image' | 'raw' | 'video';
  type: 'upload' | 'authenticated' | 'private';
  format?: string;
}

function parseAssetUrl(url: string): AssetInfo | null {
  const match = url.match(/\/(image|raw|video)\/(upload|authenticated|private)\//);
  if (!match) return null;
  const resourceType = match[1] as AssetInfo['resourceType'];
  // Raw public ids already carry their extension; image/video ids need the format passed.
  const ext = url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1];
  return { resourceType, type: match[2] as AssetInfo['type'], format: resourceType === 'raw' ? undefined : ext };
}

/**
 * The URL a client may use to open a stored file. For private assets this is a signed
 * download link that stops working after `expiresInSeconds`. The stored secure_url is
 * never handed out, since its embedded signature never expires. Assets uploaded before
 * private storage existed are still public and come back unchanged until migrated
 * (see utils/migratePrivateAssets.ts).
 */
export function deliveryUrl(storedUrl: string, publicId: string, expiresInSeconds = 3600): string {
  const asset = parseAssetUrl(storedUrl);
  if (!asset || asset.type === 'upload' || !publicId) return storedUrl;
  return cloudinary.utils.private_download_url(publicId, asset.format as string, {
    resource_type: asset.resourceType,
    type: asset.type,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
  });
}

/**
 * Schema toJSON option for models holding private files: every API response carries a
 * fresh expiring link in `url` instead of the stored one.
 */
export const withDeliveryUrl = {
  transform: (_doc: unknown, ret: Record<string, any>) => {
    if (ret.url) ret.url = deliveryUrl(ret.url, ret.publicId);
    return ret;
  },
};

/** Server-side download of a stored file, public or private. */
export function fetchAsset(storedUrl: string, publicId: string): Promise<Buffer> {
  return fetchBuffer(deliveryUrl(storedUrl, publicId, 300));
}
