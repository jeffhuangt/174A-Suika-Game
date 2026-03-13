import * as THREE from 'three';
import { buildCupGeometry, assembleCup } from './utils.js';

export function makeFluidCup() {
  const height = 24;
  const radiusBottom = 9;
  const radiusTop = 11;
  const wall = 0.15;
  const bottom = 0.25;
  const segments = 160;
  const rimLip = 0.06;

  const innerBottomR = Math.max(0.01, radiusBottom - wall);
  const innerTopR = Math.max(0.01, radiusTop - wall);

  const geoData = buildCupGeometry({
    height,
    radiusBottom,
    radiusTop,
    wall,
    bottom,
    segments,
    rimLip,
  });

  const cup = assembleCup(geoData, height, bottom, radiusTop, rimLip);

  cup.userData.cup = {
    ...(cup.userData.cup || {}),
    height,
    bottom,
    innerBottomR,
    innerTopR,
    outerTopR: radiusTop + rimLip,
  };

  cup.userData.water = {
    enabled: true,
    levelYLocal: bottom + (height - bottom) * 0.42,
    density: 1.1,
    drag: 2.6,
    angularDrag: 2.2,
    surfaceDamping: 2.0,
    splashSpeedThreshold: 4.0,
  };

  const waterLevel = cup.userData.water.levelYLocal;
  const waterT = (waterLevel - bottom) / (height - bottom);

  // radius of water where the surface is
  const waterTopRadius =
    innerBottomR + waterT * (innerTopR - innerBottomR) - 0.08;

  // radius of water near the bottom
  const waterBottomRadius = innerBottomR - 0.03;

  // height of the water body
  const waterHeight = Math.max(0.05, waterLevel - bottom);

  // --- water body (gives volume) ---
  const waterBodyGeo = new THREE.CylinderGeometry(
    Math.max(0.1, waterTopRadius),
    Math.max(0.1, waterBottomRadius),
    waterHeight,
    64,
    1,
    false
  );

  const waterBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x8fdcff,
    transparent: true,
    opacity: 0.22,
    transmission: 0.92,
    roughness: 0.04,
    metalness: 0.0,
    ior: 1.33,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const waterBodyMesh = new THREE.Mesh(waterBodyGeo, waterBodyMat);
  waterBodyMesh.position.y = bottom + waterHeight / 2;
  waterBodyMesh.renderOrder = 19;
  cup.add(waterBodyMesh);

  // --- top water surface ---
  const waterSurfaceGeo = new THREE.CircleGeometry(Math.max(0.1, waterTopRadius), 64);
  waterSurfaceGeo.rotateX(-Math.PI / 2);

  const waterSurfaceMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8ecff,
    transparent: true,
    opacity: 0.55,
    transmission: 0.35,
    roughness: 0.02,
    metalness: 0.0,
    ior: 1.33,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const waterSurfaceMesh = new THREE.Mesh(waterSurfaceGeo, waterSurfaceMat);
  waterSurfaceMesh.position.y = waterLevel + 0.02;
  waterSurfaceMesh.renderOrder = 20;
  cup.add(waterSurfaceMesh);

  cup.userData.water.mesh = waterSurfaceMesh;
  cup.userData.water.bodyMesh = waterBodyMesh;
  cup.userData.water.baseLevelYLocal = waterLevel;

  return cup;
}