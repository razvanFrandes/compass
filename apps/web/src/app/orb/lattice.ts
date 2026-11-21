/*
  The lattice: where the orb's points sit, and how the sphere is seen.
  The vertex shader repeats `latticePoint` from the vertex index alone, so no geometry is uploaded;
  this copy exists so the layout and the framing can be tested without a GPU.
*/

/** The golden angle: each point is this far around the axis from the one before it. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Camera distance in sphere radii, and the scale from view space to the canvas (1 = the canvas edge). */
export const LATTICE_DIST = 2.7;
export const LATTICE_FOCAL = 1.42;

/**
 * Point `i` of `count` on the unit sphere, spread evenly by a Fibonacci spiral: heights are evenly
 * spaced from the top to the bottom, and each point turns by the golden angle. No poles, no seams.
 */
export function latticePoint(i: number, count: number): [number, number, number] {
  const y = 1 - (2 * (i + 0.5)) / count;
  const r = Math.sqrt(1 - y * y);
  const phi = i * GOLDEN_ANGLE;
  return [Math.cos(phi) * r, y, Math.sin(phi) * r];
}

/**
 * How far from the centre of the canvas the outline of a sphere of `radius` is drawn (1 = the canvas edge).
 * With perspective the outline is not the equator: it is the circle where the line of sight grazes the sphere.
 */
export function silhouetteRadius(radius: number) {
  return (LATTICE_FOCAL * radius) / Math.sqrt(LATTICE_DIST * LATTICE_DIST - radius * radius);
}

/** Fewer points on a small orb, so they stay separate dots instead of filling in; the composer's 32 px mark has a few hundred. */
export const MARK_COUNT = 280;
export const pointCount = (sizePx: number) => (sizePx <= 48 ? MARK_COUNT : sizePx <= 120 ? 1100 : 2600);
