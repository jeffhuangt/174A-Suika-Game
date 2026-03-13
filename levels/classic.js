import { buildCupGeometry, assembleCup } from './utils.js';

export function makeClassicCup() {
  const height = 24;
  const radiusBottom = 9;
  const radiusTop = 11;
  const wall = 0.15;
  const bottom = 0.25;
  const segments = 160;
  const rimLip = 0.06;

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
