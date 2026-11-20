/**
 * A unit icosphere: an icosahedron whose faces are split `detail` times and pushed out to the sphere.
 * Unlike a latitude/longitude sphere it has no poles, so a displaced surface has no pinch points.
 * Vertices: 10·4^detail + 2. Triangles: 20·4^detail.
 */
export function icosphere(detail: number): { positions: Float32Array; indices: Uint32Array } {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: number[] = [];
  const add = (x: number, y: number, z: number) => {
    const l = Math.hypot(x, y, z);
    verts.push(x / l, y / l, z / l);
    return verts.length / 3 - 1;
  };
  // prettier-ignore
  const base = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  for (const [x, y, z] of base) add(x, y, z);
  // prettier-ignore
  let faces = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
    1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
    4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ];

  for (let d = 0; d < detail; d++) {
    const cache = new Map<number, number>();
    const count = verts.length / 3 + (faces.length / 3) * 1.5;
    const mid = (a: number, b: number) => {
      const key = a < b ? a * count + b : b * count + a;
      let m = cache.get(key);
      if (m === undefined) {
        m = add(verts[a * 3] + verts[b * 3], verts[a * 3 + 1] + verts[b * 3 + 1], verts[a * 3 + 2] + verts[b * 3 + 2]);
        cache.set(key, m);
      }
      return m;
    };
    const next: number[] = [];
    for (let i = 0; i < faces.length; i += 3) {
      const a = faces[i];
      const b = faces[i + 1];
      const c = faces[i + 2];
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    faces = next;
  }
  return { positions: new Float32Array(verts), indices: new Uint32Array(faces) };
}
