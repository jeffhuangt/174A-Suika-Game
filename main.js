import * as THREE from 'three';
import { setupScene } from './setupScene.js';
import { createFruitsTextures } from './fruitTextures.js';
import { createFaceDecals } from './faceDecals.js';
import { merge } from './merge.js';
import { TOP_OUT_LIMIT } from './constants.js';
import { fruitScores, addScore } from './ui.js';
import { makeCup } from './cup.js';
import { stepPhysics } from './physics.js';

const { scene, camera, renderer, controls } = setupScene();
const { fruitMaterials, faceMaterials, fruitOrder } = createFruitsTextures(renderer);


const timer = new THREE.Timer();
const fallingFruits = [];
let gameOver = false;
let topOutTime = 0;
let lastDropTime = 0;

const dropSound = new Audio('sounds/drop.mp3');
const mergeSound = new Audio('sounds/merge.mp3');

dropSound.volume = 1.0;
mergeSound.volume = 0.3;

function playDropSound() {
  dropSound.currentTime = 0;
  dropSound.play().catch(()=>{});
}

// function playMergeSound() {
//   mergeSound.currentTime = 0;
//   mergeSound.play().catch(()=>{});
// }

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

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

function createCheckerTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  const size = 64;
  const tiles = 512 / size;
  for (let row = 0; row < tiles; row++) {
    for (let col = 0; col < tiles; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#f0ddc5' : '#dfc0a0';
      ctx.fillRect(col * size, row * size, size, size);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

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

const floorY = tableTopY - tableThickness;
const roomWallColor = 0xaee9ff;
const roomW = 160, roomD = 130, roomH = 70;
const roomZ0 = -40, roomZ1 = roomZ0 + roomD;
const roomX0 = -roomW / 2, roomX1 = roomW / 2;
const roomZC = (roomZ0 + roomZ1) / 2;
const roomYC = floorY + roomH / 2;
const wallMat = new THREE.MeshStandardMaterial({ color: roomWallColor, roughness: 0.9 });

const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
backWall.position.set(0, roomYC, roomZ0);
scene.add(backWall);

const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
frontWall.rotation.y = Math.PI;
frontWall.position.set(0, roomYC, roomZ1);
scene.add(frontWall);

const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
leftWall.rotation.y = Math.PI / 2;
leftWall.position.set(roomX0, roomYC, roomZC);
scene.add(leftWall);

const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
rightWall.rotation.y = -Math.PI / 2;
rightWall.position.set(roomX1, roomYC, roomZC);
scene.add(rightWall);

const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
const floorMat = new THREE.MeshStandardMaterial({ map: createCheckerTexture(), roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, floorY, roomZC);
scene.add(floor);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), wallMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.set(0, floorY + roomH, roomZC);
scene.add(ceiling);

const cup = makeCup({ height: 24, radiusBottom: 9, radiusTop: 11, wall:0.15, bottom: 0.25 });
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
  line.renderOrder = 11;
  line.computeLineDistances();
  scene.add(line);
  return line;
}

function getDropHitY(mesh, radius, cup, tableTopY) {
  const cupData = cup.userData.cup;

  const cupBaseY = cup.position.y;
  const cupBottomY = cupBaseY + cupData.bottom;

  const dx = mesh.position.x - cup.position.x;
  const dz = mesh.position.z - cup.position.z;
  const rXZ = Math.hypot(dx, dz);

  const maxTopFit = cupData.innerTopR - radius;
  const maxBottomFit = cupData.innerBottomR - radius;

  // Ouside the opening entirely -> table
  if (rXZ > maxTopFit) {
    return tableTopY;
  }

  // Fits all the way to the bottom -> cup bottom
  if (rXZ <= maxBottomFit) {
    return cupBottomY;
  }

  // Otherwise it hits the inner wall
  const t = (rXZ - maxBottomFit) / (maxTopFit - maxBottomFit);
  const yLocalAtWall = cupData.bottom + t * (cupData.height - cupData.bottom);
  const wallBottomY = cupBaseY + yLocalAtWall - radius;

  return wallBottomY;
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
  sphere.renderOrder = 1;
  sphere.children.forEach(child => {
    child.renderOrder = 2;
  });
});

const planeHeight = 18;
const planeLength = 25;
const maxFruitIndex = 5;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);

let nextFruitIndex = Math.floor(Math.random() * maxFruitIndex);
let previewMesh = null;
let previewGuideLine = null;

function updatePreviewMesh() {
  if (gameOver) {
    clearPreview();
    return;
  }
  if (previewMesh) {
    scene.remove(previewMesh);
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
  material.depthWrite = true;

  previewMesh = new THREE.Mesh(geometry, material);
  previewMesh.position.set(0, 18, 0);
  previewMesh.userData.fruitName = fruitName;
  previewMesh.renderOrder = 1;
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

function clearPreview() {
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.material.dispose();
    previewMesh = null;
  }

  if (previewGuideLine) {
    scene.remove(previewGuideLine);
    previewGuideLine = null;
  }
}

function hasFruitAboveOpening() {
  const cupData = cup.userData.cup;
  const cupOpeningY = cup.position.y + cupData.height;
  const now = performance.now();

  for (const f of fallingFruits) {
    if (!f.mesh) continue;
    if (now - f.spawnTime < 1500) continue;

    if (f.pos.y + f.radius > cupOpeningY) {
      return true;
    }
  }

  return false;
}

window.addEventListener('pointermove', onPointerMove);

function spawnFruit() {
  if (gameOver || !previewMesh) return;
  if (performance.now() - lastDropTime < 700) return;

  const fruitIndex = nextFruitIndex;
  const fruitName = fruitOrder[fruitIndex];

  const geometry = sphereGeometries[fruitIndex];
  const radius = geometry.parameters.radius;

  const mat = fruitMaterials[fruitName];
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.renderOrder = 1;
  mesh.material.depthWrite = true;
  mesh.userData.fruitName = fruitName;

  // spawn at preview position
  mesh.position.copy(previewMesh.position);

  scene.add(mesh);

  // add face decal
  createFaceDecals(mesh, fruitName, faceMaterials, { yaw: 0 });

  const fruitObj = {
    mesh,
    radius,
    pos: mesh.position.clone(),
    vel: new THREE.Vector3(0, 0, 0),
    mass: radius * radius,
    isSettled: false,
    sleepFrames: 0,
    prevPos: mesh.position.clone(),
    angularVel: new THREE.Vector3(0, 0, 0),
    spawnTime: performance.now(),
  }

  fallingFruits.push(fruitObj);
  lastDropTime = performance.now();

  playDropSound();

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

  stepPhysics(fallingFruits, cup, tableTopY, dt);

  merge({ scene, fallingFruits, fruitOrder, sphereGeometries, fruitMaterials, faceMaterials, createFaceDecals, fruitScores, addScore, mergeSound });

  if (!gameOver) {
    if (hasFruitAboveOpening()) {
      topOutTime += dt;

      if (topOutTime >= TOP_OUT_LIMIT) {
        gameOver = true;
        clearPreview();
      }
    } else {
      topOutTime = 0;
    }
  }

  controls.update();
  renderer.render(scene, camera);

}

renderer.setAnimationLoop(animate);
