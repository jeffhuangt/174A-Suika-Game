import { buildCupGeometry, assembleCup } from './utils.js';

export function makeTallCup() {
  const height = 40;
  const radiusBottom = 7;
  const radiusTop = 8;
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
