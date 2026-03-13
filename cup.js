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

export function makeCup({ 
  height = 30,
  radiusBottom = 12,
  radiusTop = 15, 
  wall = 0.15, 
  bottom = 0.25,
  segments = 160,
  rimLip = 0.06,
} = {}) {

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

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, //0xe8f6ff,
    transmission: 1.0,
    thickness: wall,
    roughness: 0.02,
    metalness: 0.0,
    ior: 1.5,
    transparent: true,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
    envMapIntensity: 1.5,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
  });

  const cupMesh = new THREE.Mesh(cupGeometry, glassMaterial);
  cupMesh.renderOrder = 3;
  cupMesh.castShadow = true;
  cupMesh.receiveShadow = true;

  const cup = new THREE.Group();
  cup.add(cupMesh);

  cup.userData.cup = {
    height,
    bottom,
    innerBottomR,
    innerTopR,
  };

  return cup;
}
