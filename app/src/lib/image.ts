export const MAX_LOGO_BYTES = 100_000;

export async function fileToHexLogo(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_LOGO_BYTES) {
      reject(new Error(`Logo must be under ${MAX_LOGO_BYTES / 1000} KB (yours: ${Math.round(file.size / 1000)} KB)`));
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      const ar = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ar > 1) { sw = img.height; sx = (img.width - sw) / 2; }
      else if (ar < 1) { sh = img.width; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png", 0.85));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export interface SavedToken {
  mint: string;
  name: string;
  symbol: string;
  logo?: string;
  createdAt: number;
  trustScore: number;
  tier: 0 | 1;
  signature: string;
}

const KEY = "humbletrust:tokens";

export const saveToken = (t: SavedToken) => {
  const all = listTokens().filter(x => x.mint !== t.mint);
  all.unshift(t);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 100)));
};

export const listTokens = (): SavedToken[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
};
