/**
 * Quick in-browser checks on a visa photo: white background, enough pixels, 35 x 45 shape.
 * Returns plain-language warnings; none of them block the upload.
 */
export async function checkVisaPhoto(file: File): Promise<string[]> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) return [];
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const warnings: string[] = [];
    const { naturalWidth: w, naturalHeight: h } = img;
    if (w < 600 || h < 600) warnings.push(`The photo is ${w} x ${h} pixels; at least 600 x 600 is needed.`);
    const ratio = w / h;
    if (Math.abs(ratio - 35 / 45) > 0.08) warnings.push('The photo should be portrait, 35 x 45 mm (about 7:9).');

    // Sample a thin band along the top and sides, where only background should be.
    const scale = Math.min(1, 200 / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return warnings;
    ctx.drawImage(img, 0, 0, cw, ch);
    const { data } = ctx.getImageData(0, 0, cw, ch);
    const band = Math.max(2, Math.round(cw * 0.06));
    let total = 0;
    let light = 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const edge = y < band || x < band || x >= cw - band;
        if (!edge || y > ch * 0.7) continue;
        const i = (y * cw + x) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        total++;
        if (min > 200 && max - min < 30) light++;
      }
    }
    if (total && light / total < 0.85) warnings.push('The background does not look plain white. Embassies usually reject coloured or busy backgrounds.');
    return warnings;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}
