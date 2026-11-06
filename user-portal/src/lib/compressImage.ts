/**
 * Shrinks large JPG/PNG photos from phones before upload: longest side capped at 2400 px
 * (passport OCR needs about 1000), saved as JPEG. Small files, PDFs and Word files pass through,
 * as does any image that would not come out smaller.
 */
export async function compressImage(file: File, { maxSide = 2400, quality = 0.85, minBytes = 1.5 * 1024 * 1024 } = {}): Promise<File> {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < minBytes) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // PNG transparency would turn black as JPEG, so paint white underneath.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.(png|jpe?g)$/i, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
