import { buildCupGeometry, assembleCup } from './utils.js';

export function makeEarthquakeCup() {
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

  const cup = assembleCup(geoData, height, bottom, radiusTop, rimLip);

  cup.userData.shake = {
    enabled: true,
    continuous: true,
    intensity: 1.4,
    speed: 2.5,
  };

  return cup;
}
