/**
 * Lecture des pièces du pack de bâtiments de Kenney (assets-src/buildings, « Building Kit », CC0) :
 * fichiers .obj dont les couleurs viennent d'une texture de palette (Textures/colormap.png, image indexée)
 * lue par les coordonnées UV, et non de couleurs de matériau comme le pack nature.
 * Utilisé par convert-buildings.mjs (npm run buildings).
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** Décodeur PNG minimal : 8 bits, sans entrelacement, types 2 (RVB), 3 (palette) et 6 (RVBA). */
export function readPng(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path} n'est pas un PNG`);
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  let palette = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), name = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (name === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (name === 'PLTE') palette = data;
    else if (name === 'IDAT') idat.push(data);
    else if (name === 'IEND') break;
  }
  if (depth !== 8 || interlace !== 0 || ![2, 3, 6].includes(type)) throw new Error(`${path} : PNG non géré (profondeur ${depth}, type ${type}, entrelacement ${interlace})`);
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  /** Couleur (sRGB 0-255) au point UV (origine en bas à gauche, comme OBJ) */
  const sample = (u, v) => {
    const x = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * height)));
    const i = y * stride + x * bpp;
    if (type === 3) { const k = px[i] * 3; return [palette[k], palette[k + 1], palette[k + 2]]; }
    return [px[i], px[i + 1], px[i + 2]];
  };
  return { width, height, sample };
}

const toLinear = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const srgbToLinear = ([r, g, b]) => [toLinear(r), toLinear(g), toLinear(b)];

/**
 * Lit un .obj : positions, couleurs (palette, en linéaire) et triangles. Un sommet OBJ utilisé avec deux
 * coordonnées UV (donc deux couleurs) devient deux sommets. Quads et polygones : découpés en éventail.
 */
export function readObj(path, palette) {
  const v = [], vt = [];
  const index = new Map();
  const positions = [], colors = [], indices = [];
  const vertex = (vi, ti) => {
    const key = `${vi}/${ti}`;
    let i = index.get(key);
    if (i === undefined) {
      i = positions.length / 3;
      index.set(key, i);
      positions.push(...v[vi]);
      colors.push(...srgbToLinear(ti >= 0 ? palette.sample(...vt[ti]) : [255, 255, 255]));
    }
    return i;
  };
  const seen = new Set(); // les .obj du pack répètent chaque pièce deux fois : triangles identiques ignorés
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') v.push([+t[1], +t[2], +t[3]]);
    else if (t[0] === 'vt') vt.push([+t[1], +t[2]]);
    else if (t[0] === 'f') {
      const face = t.slice(1).map((s) => { const [a, b] = s.split('/'); return vertex(+a - 1, b ? +b - 1 : -1); });
      for (let k = 1; k < face.length - 1; k++) {
        const tri = [face[0], face[k], face[k + 1]];
        const key = [...tri].sort((p, q) => p - q).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        indices.push(...tri);
      }
    }
  }
  return { positions: Float32Array.from(positions), colors: Float32Array.from(colors), indices: Uint32Array.from(indices) };
}

/** Boîte englobante d'une pièce : { min, max, size } */
export function bounds(piece) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < piece.positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], piece.positions[i + k]); max[k] = Math.max(max[k], piece.positions[i + k]); }
  return { min, max, size: max.map((m, k) => m - min[k]) };
}
