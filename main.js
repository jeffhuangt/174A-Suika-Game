import * as THREE from 'three';
import { setupScene } from './setupScene.js';
import { createFruitsTextures } from './fruitTextures.js';
import { createFaceDecals } from './faceDecals.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { merge } from './merge.js';
import { velocity } from 'three/tsl';

const { scene, camera, renderer, controls } = setupScene();
const { fruitMaterials, faceMaterials, fruitOrder } = createFruitsTextures(renderer);


const timer = new THREE.Timer();
const fallingFruits = [];
const GRAVITY = -25;
let activeFruit = null;

function generateSphereGeometries(numSpheres, radius, scale) {
  const geometries = [];
  let curRadius = radius;
  for (let i = 0; i < numSpheres; i++) {
    const geometry = new THREE.SphereGeometry(curRadius, 32, 16);
    geometries.push(geometry);
    curRadius *= scale;
  }
  return geometries;
}

// create a table 
const tableWidth = 60;
const tableDepth = 30;
const tableThickness = 1.2;

const tableGeo = new THREE.BoxGeometry(
  tableWidth,
  tableThickness,
  tableDepth
);

const tableMat = new THREE.MeshStandardMaterial({
  color: 0xf5d7b2,
  roughness: 0.85,
  metalness: 0.0,
});

const table = new THREE.Mesh(tableGeo, tableMat);

// since spheres sit at y = 0, lower the table
table.position.y = - (tableThickness / 2) - 8.0;

const tableBox = new THREE.Box3().setFromObject(table);
const tableTopY = tableBox.max.y;
scene.add(table);

function lathe(points, segments) {
    const g = new THREE.LatheGeometry(points, segments);
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
    const outerPts = [
        new THREE.Vector2(radiusBottom, 0.0),
        new THREE.Vector2(radiusBottom + 0.05, 0.15),
        new THREE.Vector2(radiusBottom + 0.1, 0.35),
        new THREE.Vector2(radiusTop - 0.1, height - 0.35),
        new THREE.Vector2(radiusTop, height - 0.1),
        new THREE.Vector2(radiusTop + rimLip, height),
    ]

    const innerBottomR = Math.max(0.01, radiusBottom - wall);
    const innerTopR = Math.max(0.01, radiusTop - wall);
    
    const innerPts = [
        new THREE.Vector2(innerBottomR, bottom),
        new THREE.Vector2(innerBottomR + 0.04, bottom + 0.2),
        new THREE.Vector2(innerTopR - 0.06, height - 0.35),
        new THREE.Vector2(innerTopR, height),
    ];

    const outerWall = lathe(outerPts, segments);
    const innerWall = flipGeometry(lathe(innerPts, segments));

    const outerBottom = new THREE.CircleGeometry(radiusBottom, segments);
    outerBottom.rotateX(-Math.PI / 2);
    outerBottom.translate(0, 0, 0);
    outerBottom.computeVertexNormals();

    const innerBottom = new THREE.CircleGeometry(innerBottomR, segments);
    innerBottom.rotateX(Math.PI / 2);
    innerBottom.translate(0, bottom, 0);
    innerBottom.computeVertexNormals();

    const outerTopR = radiusTop + rimLip;
    const rim = new THREE.RingGeometry(innerTopR, outerTopR, segments);
    rim.rotateX(Math.PI / 2);
    rim.translate(0, height, 0);
    rim.computeVertexNormals();

    const cupGeometry = mergeGeometries([outerWall, innerWall, outerBottom, innerBottom, rim], true);
    cupGeometry.computeVertexNormals();

    const cupMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xe8f6ff,
        transmission: 1.0,
        roughness: 0.02,
        metalness: 0.0,
        ior: 1.5,
        thickness: wall * 8.0,
        transparent: true,
        opacity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.01,
        envMapIntensity: 1.5,
        side: THREE.FrontSide,
    });
    cupMaterial.depthWrite = false;
    cupMaterial.depthTest = true;

    const cup = new THREE.Mesh(cupGeometry, cupMaterial);
    cup.castShadow = true;
    cup.receiveShadow = true;

    cup.userData.cup = {
      height,
      bottom,
      innerBottomR,
      innerTopR,
    };

    return cup;
}

const cup = makeCup({ height: 30, wall:0.15, bottom: 0.25 });
cup.renderOrder = 2;
cup.position.set(0, tableTopY + 0.01, 0); // x = -50 before
scene.add(cup);

function createDropGuide() {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3()
  ]);

  const material = new THREE.LineDashedMaterial({
    color: 0x0055ff,
    dashSize: 0.6,
    gapSize: 0.3,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
  });

  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  scene.add(line);
  return line;
}

function getDropHitY(mesh, radius, cup, tableTopY) {
  const cupData = cup.userData.cup;

  const cupBaseY = cup.position.y;
  const cupInnerBottomY = cupBaseY + cupData.bottom;

  const dx = mesh.position.x - cup.position.x;
  const dz = mesh.position.z - cup.position.z;
  const rXZ = Math.hypot(dx, dz);

  const overCupOpening = rXZ <= (cupData.innerTopR - radius);

  if (overCupOpening) {
    return cupInnerBottomY;
  }

  return tableTopY;
}

const sphereGeometries = generateSphereGeometries(11, 1, 1.25);
const sphereMeshes = [];
let xOffset = 0;
let zIndex = -25;
sphereGeometries.forEach((geometry, index) => {
  const fruitName = fruitOrder[index] ?? 'no';
  const material = fruitMaterials[fruitName];

  const sphere = new THREE.Mesh(geometry, material);

  sphere.userData.fruitName = fruitName;

  const r = geometry.parameters.radius;
  xOffset += r + 1;
  sphere.position.x = xOffset;
  xOffset += r + 1;
  sphere.position.z = zIndex;
  sphereMeshes.push(sphere);
  scene.add(sphere);
});
const totalWidth = xOffset;
sphereMeshes.forEach(sphere => { sphere.position.x -= totalWidth / 2; });

scene.updateMatrixWorld(true);

sphereMeshes.forEach(sphere => {
  createFaceDecals(sphere, sphere.userData.fruitName, faceMaterials, { yaw: 0 });
});

const planeHeight = 25;
const planeLength = 25;
const maxFruitIndex = 4;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);

let nextFruitIndex = Math.floor(Math.random() * maxFruitIndex);
let previewMesh = null;
let previewGuideLine = null;

function updatePreviewMesh() {
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
    previewMesh.material.dispose();
  }

  if (previewGuideLine) {
    scene.remove(previewGuideLine);
  }

  const fruitName = fruitOrder[nextFruitIndex];
  const geometry = sphereGeometries[nextFruitIndex];
  const material = fruitMaterials[fruitName].clone();
  material.transparent = true;
  material.opacity = 0.99;

  previewMesh = new THREE.Mesh(geometry, material);
  previewMesh.position.set(0, 25, 0);
  previewMesh.userData.fruitName = fruitName;
  scene.add(previewMesh);

  createFaceDecals(previewMesh, fruitName, faceMaterials, { yaw: 0 });

  previewGuideLine = createDropGuide();
}

updatePreviewMesh();

function clampPreviewToCup(target, previewRadius) {
  const cupData = cup.userData.cup;

  const dx = target.x - cup.position.x;
  const dz = target.z - cup.position.z;
  const dist = Math.hypot(dx, dz);

  const allowedRadius = Math.max(0, cupData.innerTopR - previewRadius - 0.2);

  if (dist > allowedRadius && dist > 1e-6) {
    const s = allowedRadius / dist;
    target.x = cup.position.x + dx * s;
    target.z = cup.position.z + dz * s;
  }

  return target;
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);

  if (target && previewMesh) {
    const previewRadius  = previewMesh.geometry.parameters.radius;
    clampPreviewToCup(target, previewRadius);
    previewMesh.position.copy(target);
    previewMesh.position.y = planeHeight;
  }
}

window.addEventListener('pointermove', onPointerMove);

function spawnFruit() {
  if (!previewMesh) return;
  if (activeFruit && !activeFruit.isSettled) return;

  const fruitIndex = nextFruitIndex;
  const fruitName = fruitOrder[fruitIndex];

  const geometry = sphereGeometries[fruitIndex];
  const radius = geometry.parameters.radius;

  const mat = fruitMaterials[fruitName];
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.fruitName = fruitName;

  // spawn at preview position
  mesh.position.copy(previewMesh.position);

  scene.add(mesh);

  // add face decal
  createFaceDecals(mesh, fruitName, faceMaterials, { yaw: 0 });

  const fruitObj = {
    mesh,
    velocityY: 0,
    radius,
    guideLine: createDropGuide(),
    isSettled: false,
  }

  fallingFruits.push(fruitObj);
  activeFruit = fruitObj;

  // update next fruit
  nextFruitIndex = Math.floor(Math.random() * 5);
  updatePreviewMesh();

  // snap to pointer
  raycaster.setFromCamera(pointer, camera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);
  if (target && previewMesh) {
    const previewRadius  = previewMesh.geometry.parameters.radius;
    clampPreviewToCup(target, previewRadius);
    previewMesh.position.copy(target);
    previewMesh.position.y = planeHeight;
  }
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') spawnFruit();
});

function animate() {

  timer.update();

  const dt = Math.min(timer.getDelta(), 1 / 30); //0.033);

  if (previewMesh && previewGuideLine && previewGuideLine.geometry) {
    const previewRadius = previewMesh.geometry.parameters.radius;
    const hitY = getDropHitY(previewMesh, previewRadius, cup, tableTopY);

    const start = new THREE.Vector3(
      previewMesh.position.x,
      previewMesh.position.y - previewRadius - 0.02,
      previewMesh.position.z
    );

    const end = new THREE.Vector3(
      previewMesh.position.x,
      hitY,
      previewMesh.position.z
    );

    previewGuideLine.geometry.setFromPoints([start, end]);
    previewGuideLine.computeLineDistances();
  }

  // tableBox.setFromObject(table);
  // const tableTopY = tableBox.max.y;

  // physics part
  for (const f of fallingFruits) {
    if (!f.mesh) continue;

    if(!f.guideLine) {
      f.guideLine = createDropGuide();
    }

    f.velocityY += GRAVITY * dt;
    f.mesh.position.y += f.velocityY * dt;

    // collide with table top
    if (f.mesh.position.y - f.radius <= tableTopY) {
      f.mesh.position.y = tableTopY + f.radius;
      f.velocityY = 0;
      f.isSettled = true;

      if (activeFruit === f) {
        activeFruit = null;
      }
    }

    if (f.guideLine) {
      const hitY = getDropHitY(f.mesh, f.radius, cup, tableTopY);

      const start = new THREE.Vector3(
        f.mesh.position.x,
        f.mesh.position.y - f.radius - 0.02,
        f.mesh.position.z
      );

      const end = new THREE.Vector3(
        f.mesh.position.x,
        hitY,
        f.mesh.position.z
      );

      f.guideLine.geometry.setFromPoints([start, end]);
      f.guideLine.computeLineDistances();
      //console.log('falling fruit entry: ', f);
    }
  }

  merge({ scene, fallingFruits, fruitOrder, sphereGeometries, fruitMaterials, faceMaterials, createFaceDecals, });

  controls.update();
  renderer.render(scene, camera);

}

renderer.setAnimationLoop(animate);