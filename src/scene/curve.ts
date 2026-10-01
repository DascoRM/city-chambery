/**
 * Courbe horaire : points [heure, valeur] interpolés linéairement, bouclant sur 24 h (après le dernier point,
 * on revient vers le premier). Sert à la foule des passants et à la part de fenêtres allumées.
 */
export function curveAt(curve: [number, number][], h: number): number {
  const n = curve.length;
  if (!n) return 1;
  for (let i = 0; i < n; i++) {
    const [h0, v0] = curve[i], [h1, v1] = curve[(i + 1) % n];
    const hh = i + 1 < n ? h1 : h1 + 24;
    const x = h < h0 && i === 0 ? h + 24 : h;
    if (x >= h0 && x <= hh) return hh === h0 ? v0 : v0 + ((v1 - v0) * (x - h0)) / (hh - h0);
  }
  return curve[0][1];
}
