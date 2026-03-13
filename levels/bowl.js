import { buildCupGeometry, assembleCup } from './utils.js';

export function makeBowlCup() {
  const height = 15;
  const radiusBottom = 4;
  const radiusTop = 18;
  const wall = 0.15;
  const bottom = 0.25;
  const segments = 160;
  const rimLip = 0.05;

  const geoData = buildCupGeometry({
    height,
    radiusBottom,
    radiusTop,
    wall,
    bottom,
    segments,
    rimLip
  });

  return assembleCup(geoData, height, bottom, radiusTop, rimLip);
}
