import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function lathe(points, segments) {
  const g = new THREE.LatheGeometry(points, segments);
  g.rotateY(Math.PI / segments);
  g.computeVertexNormals();
  return g;
}

function flipGeometry(g) {
  g.scale(-1, 1, 1);
  g.computeVertexNormals();
  return g;
}

// Reusable cup geometry construction logic
export function buildCupGeometry({
  height,
  radiusBottom,
  radiusTop,
  wall,
  bottom,
  segments,
  rimLip
}) {
  const innerBottomR = Math.max(0.01, radiusBottom - wall);
  const innerTopR = Math.max(0.01, radiusTop - wall);
  const outerTopR = radiusTop + rimLip;

  // Outer wall only (no axis points)
  const outerPts = [
    new THREE.Vector2(radiusBottom, 0.0),
    new THREE.Vector2(radiusBottom + 0.05, 0.15),
    new THREE.Vector2(radiusBottom + 0.10, 0.35),
    new THREE.Vector2(radiusTop - 0.10, height - 0.35),
    new THREE.Vector2(radiusTop, height - 0.10),
    new THREE.Vector2(outerTopR, height),
  ];

  // Inner wall only (no axis points)
  const innerPts = [
    new THREE.Vector2(innerBottomR, bottom),
    new THREE.Vector2(innerBottomR + 0.04, bottom + 0.20),
    new THREE.Vector2(innerTopR - 0.06, height - 0.35),
    new THREE.Vector2(innerTopR, height),
  ];

  const outerWall = lathe(outerPts, segments);
  const innerWall = flipGeometry(lathe(innerPts, segments));

  // Bottom thickness side (connects outer bottom edge to inner bottom edge)
  const bottomSide = lathe([
    new THREE.Vector2(radiusBottom, 0.0),
    new THREE.Vector2(innerBottomR, bottom),
  ], segments);

  // Outside bottom
  const outerBottom = new THREE.CircleGeometry(radiusBottom, segments);
  outerBottom.rotateX(-Math.PI / 2);
  outerBottom.translate(0, 0, 0);
  outerBottom.computeVertexNormals();

  // Inside floor
  const innerBottom = new THREE.CircleGeometry(innerBottomR, segments);
  innerBottom.rotateX(Math.PI / 2);
  innerBottom.translate(0, bottom, 0);
  innerBottom.computeVertexNormals();

  // Top rim thickness
  const rim = new THREE.RingGeometry(innerTopR, outerTopR, segments);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, height, 0);
  rim.computeVertexNormals();

  const cupGeometry = mergeGeometries(
    [outerWall, innerWall, bottomSide, outerBottom, innerBottom, rim],
    false
  );
  cupGeometry.computeVertexNormals();

  return { cupGeometry, innerBottomR, innerTopR };
}

export function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1.0,
    thickness: 0.02,
    roughness: 0.02,
    metalness: 0.0,
    ior: 1.05,
    transparent: true,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
    envMapIntensity: 1.5,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
  });
}

export function assembleCup(geometryData, height, bottom, radiusTop, rimLip) {
  const glassMaterial = createGlassMaterial();
  const cupMesh = new THREE.Mesh(geometryData.cupGeometry, glassMaterial);
  cupMesh.renderOrder = 3;
  // Shadows configured in main depending on preferences, but usually:
  cupMesh.castShadow = false;
  cupMesh.receiveShadow = true;

  const cup = new THREE.Group();
  cup.add(cupMesh);

  cup.userData.cup = {
    height,
    bottom,
    innerBottomR: geometryData.innerBottomR,
    innerTopR: geometryData.innerTopR,
    outerTopR: radiusTop + rimLip
  };

  return cup;
}
