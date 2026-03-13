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

// create mini camera
const cupOuterRadius = 11.2;
const miniCamera = new THREE.OrthographicCamera(-cupOuterRadius, cupOuterRadius, cupOuterRadius, -cupOuterRadius, 0.1, 100);
miniCamera.position.set(0, 35, 0.1);
miniCamera.lookAt(0, 0, 0);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
topLight.position.set(0, 30, 0);
topLight.target.position.set(0, 0, 0);
topLight.castShadow = true;
topLight.shadow.mapSize.width = 2048;
topLight.shadow.mapSize.height = 2048;
topLight.shadow.camera.near = 0.5;
topLight.shadow.camera.far = 50;
const d = 35;
topLight.shadow.camera.left = -d;
topLight.shadow.camera.right = d;
topLight.shadow.camera.top = d;
topLight.shadow.camera.bottom = -d;
topLight.shadow.bias = -0.001;
scene.add(topLight);
scene.add(topLight.target);

scene.children.forEach(c => {
  if (c.isDirectionalLight && c !== topLight) {
    if (c.position.y === 10) c.intensity = 1.1;
  }
});

const timer = new THREE.Timer();
const fallingFruits = [];
let gameOver = false;
let topOutTime = 0;
let lastDropTime = 0;
let spawnDelayEnabled = true;
let showPlanes = true;

const dropSound = new Audio('sounds/drop.mp3');
const mergeSound = new Audio('sounds/merge.mp3');

dropSound.volume = 1.0;
mergeSound.volume = 0.3;

function playDropSound() {
  dropSound.currentTime = 0;
  dropSound.play().catch(() => { });
}

// function playMergeSound() {
//   mergeSound.currentTime = 0;
//   mergeSound.play().catch(()=>{});
// }

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const nextHud = document.createElement('div');
nextHud.style.position = 'fixed';
nextHud.style.top = '18px';
nextHud.style.right = '18px';
nextHud.style.width = '170px';
nextHud.style.height = '170px';
nextHud.style.borderRadius = '50%';
nextHud.style.zIndex = '99999';
nextHud.style.pointerEvents = 'none';
nextHud.style.display = 'flex';
nextHud.style.flexDirection = 'column';
nextHud.style.alignItems = 'center';
nextHud.style.justifyContent = 'center';
nextHud.style.fontFamily = `'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif`;
nextHud.style.color = '#145caa';
nextHud.style.background = `
  radial-gradient(circle at 32% 28%,
    rgba(255,255,255,0.96) 0%,
    rgba(240,248,255,0.82) 10%,
    rgba(214,233,248,0.56) 24%,
    rgba(184,214,236,0.34) 54%,
    rgba(150,192,224,0.22) 78%,
    rgba(120,170,210,0.16) 100%)
`;
nextHud.style.border = '3px solid rgba(255,255,255,0.55)';
nextHud.style.boxShadow = `
  inset 0 10px 18px rgba(255,255,255,0.72),
  inset 0 -10px 18px rgba(90,140,185,0.18),
  0 4px 12px rgba(40,90,130,0.12)
`;

const nextHighlight1 = document.createElement('div');
nextHighlight1.style.position = 'absolute';
nextHighlight1.style.width = '34px';
nextHighlight1.style.height = '20px';
nextHighlight1.style.top = '26px';
nextHighlight1.style.left = '24px';
nextHighlight1.style.borderRadius = '50%';
nextHighlight1.style.background = 'rgba(255,255,255,0.78)';
nextHighlight1.style.transform = 'rotate(-28deg)';
nextHighlight1.style.filter = 'blur(1px)';

const nextHighlight2 = document.createElement('div');
nextHighlight2.style.position = 'absolute';
nextHighlight2.style.width = '24px';
nextHighlight2.style.height = '14px';
nextHighlight2.style.right = '24px';
nextHighlight2.style.bottom = '28px';
nextHighlight2.style.borderRadius = '50%';
nextHighlight2.style.background = 'rgba(255,255,255,0.62)';
nextHighlight2.style.transform = 'rotate(28deg)';
nextHighlight2.style.filter = 'blur(1px)';

const nextTitle = document.createElement('div');
nextTitle.textContent = 'Next';
nextTitle.style.position = 'absolute';
nextTitle.style.top = '12px';
nextTitle.style.left = '50%';
nextTitle.style.transform = 'translateX(-50%)';
nextTitle.style.fontSize = '26px';
nextTitle.style.fontWeight = '800';
nextTitle.style.lineHeight = '1';
nextTitle.style.textShadow = '0 2px 0 rgba(255,255,255,0.8), 0 0 4px rgba(0,0,0,0.18)';

const nextCanvasWrap = document.createElement('div');
nextCanvasWrap.style.position = 'absolute';
nextCanvasWrap.style.left = '50%';
nextCanvasWrap.style.top = '54%';
nextCanvasWrap.style.transform = 'translate(-50%, -50%)';
nextCanvasWrap.style.width = '110px';
nextCanvasWrap.style.height = '110px';
nextCanvasWrap.style.borderRadius = '50%';
nextCanvasWrap.style.overflow = 'hidden';

const cornerMask = document.createElement('div');
cornerMask.style.position = 'fixed';
cornerMask.style.bottom = '20px';
cornerMask.style.right = '20px';
cornerMask.style.width = '250px';
cornerMask.style.height = '250px';
cornerMask.style.pointerEvents = 'none';
cornerMask.style.zIndex = '99998';
// We draw a solid color on the corners to turn the square renderer into a circle
document.body.appendChild(cornerMask);

nextHud.appendChild(nextHighlight1);
nextHud.appendChild(nextHighlight2);
nextHud.appendChild(nextTitle);
nextHud.appendChild(nextCanvasWrap);
document.body.appendChild(nextHud);

const legend = document.createElement('div');
legend.style.position = 'fixed';
legend.style.bottom = '20px';
legend.style.left = '20px';
legend.style.color = '#145caa';
legend.style.fontFamily = `'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif`;
legend.style.background = `
  radial-gradient(circle at 10% 10%,
    rgba(255,255,255,0.95) 0%,
    rgba(240,248,255,0.85) 40%,
    rgba(214,233,248,0.7) 100%)
`;
legend.style.padding = '12px 18px';
legend.style.borderRadius = '12px';
legend.style.boxShadow = `
  inset 0 4px 10px rgba(255,255,255,0.8),
  0 6px 16px rgba(40,90,130,0.15)
`;
legend.style.border = '2px solid rgba(255,255,255,0.6)';
legend.style.zIndex = '99999';
legend.style.pointerEvents = 'none';
legend.innerHTML = `
  <div style="font-weight: 800; font-size: 16px; margin-bottom: 8px; border-bottom: 2px solid rgba(20,92,170,0.2); padding-bottom: 4px;">Controls</div>
  <div style="font-size: 14px; line-height: 1.6;">
    <b style="color: #0b3d75;">Space</b>: Drop fruit<br>
    <b style="color: #0b3d75;">t, f, b, l, r</b>: Snap Camera<br>
    <b style="color: #0b3d75;">d</b>: Toggle drop delay<br>
    <b style="color: #0b3d75;">p</b>: Toggle indicator planes
  </div>
`;
document.body.appendChild(legend);

const nextScene = new THREE.Scene();

const nextCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
nextCamera.position.set(0, 0, 6);

const nextRenderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
nextRenderer.setSize(110, 110);
nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
nextRenderer.setClearColor(0x000000, 0);
nextScene.environment = scene.environment;
nextCanvasWrap.appendChild(nextRenderer.domElement);

const nextAmbient = new THREE.AmbientLight(0xffffff, 0.6);
nextScene.add(nextAmbient);

const nextDir = new THREE.DirectionalLight(0xffffff, 2.2);
nextDir.position.set(3, 4, 5);
nextScene.add(nextDir);

const nextRim = new THREE.DirectionalLight(0xffffff, 1.3);
nextRim.position.set(-4, 2, 3);
nextScene.add(nextRim);

let nextFruitMesh = null;

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
table.receiveShadow = true;

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
backWall.receiveShadow = true;
scene.add(backWall);

const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
frontWall.rotation.y = Math.PI;
frontWall.position.set(0, roomYC, roomZ1);
frontWall.receiveShadow = true;
scene.add(frontWall);

const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
leftWall.rotation.y = Math.PI / 2;
leftWall.position.set(roomX0, roomYC, roomZC);
leftWall.receiveShadow = true;
scene.add(leftWall);

const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
rightWall.rotation.y = -Math.PI / 2;
rightWall.position.set(roomX1, roomYC, roomZC);
rightWall.receiveShadow = true;
scene.add(rightWall);

const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
const floorMat = new THREE.MeshStandardMaterial({ map: createCheckerTexture(), roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, floorY, roomZC);
floor.receiveShadow = true;
scene.add(floor);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), wallMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.set(0, floorY + roomH, roomZC);
ceiling.receiveShadow = true;
scene.add(ceiling);

const cup = makeCup({ height: 24, radiusBottom: 9, radiusTop: 11, wall: 0.15, bottom: 0.25 });
cup.traverse(c => {
  if (c.isMesh) {
    c.castShadow = false;
    c.receiveShadow = true;
  }
});
cup.position.set(0, tableTopY + 0.01, 0); // x = -50 before
scene.add(cup);

const planeGeo = new THREE.CircleGeometry(cup.userData.cup.innerTopR - 0.2, 64);
planeGeo.rotateX(-Math.PI / 2);

const highestMat = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  transparent: true,
  opacity: 0.2,
  side: THREE.DoubleSide,
  depthWrite: false
});
const highestFruitPlane = new THREE.Mesh(planeGeo, highestMat);
highestFruitPlane.position.x = cup.position.x;
highestFruitPlane.position.z = cup.position.z;
highestFruitPlane.position.y = cup.position.y + cup.userData.cup.bottom;
scene.add(highestFruitPlane);

const dangerMat = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.0,
  side: THREE.DoubleSide,
  depthWrite: false
});
const dangerPlane = new THREE.Mesh(planeGeo, dangerMat);
dangerPlane.position.x = cup.position.x;
dangerPlane.position.z = cup.position.z;
dangerPlane.position.y = cup.position.y + cup.userData.cup.height;
scene.add(dangerPlane);

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
  sphere.castShadow = true;
  sphere.receiveShadow = true;

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

let currentFruitIndex = Math.floor(Math.random() * maxFruitIndex);
let nextFruitIndex = Math.floor(Math.random() * maxFruitIndex);
let previewMesh = null;
let previewGuideLine = null;

function updateNextFruitHud() {
  if (nextFruitMesh) {
    nextScene.remove(nextFruitMesh);
    nextFruitMesh.traverse(obj => {
      if (!obj.isMesh) return;
      if (obj !== nextFruitMesh && obj.geometry) obj.geometry.dispose();
      if (obj.material && obj.material !== nextFruitMesh.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    nextFruitMesh = null;
  }

  if (gameOver) return;

  const fruitName = fruitOrder[nextFruitIndex];
  const geometry = sphereGeometries[nextFruitIndex];
  const material = fruitMaterials[fruitName].clone();
  material.transparent = false;
  material.depthWrite = true;

  nextFruitMesh = new THREE.Mesh(geometry, material);
  nextFruitMesh.userData.fruitName = fruitName;
  nextScene.add(nextFruitMesh);

  createFaceDecals(nextFruitMesh, fruitName, faceMaterials, { yaw: 0 });

  // progressively larger HUD sizes per fruit
  const hudScaleByIndex = [
    0.9, // cherry
    0.9, // strawberry
    0.9, // grape
    0.9,  // orange
    0.9, // persimmon
  ];

  const scale = hudScaleByIndex[nextFruitIndex] ?? 1.0;
  nextFruitMesh.scale.setScalar(scale);
}

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

  const fruitName = fruitOrder[currentFruitIndex];
  const geometry = sphereGeometries[currentFruitIndex];
  const material = fruitMaterials[fruitName].clone();
  material.transparent = true;
  material.opacity = 0.99;
  material.depthWrite = true;

  previewMesh = new THREE.Mesh(geometry, material);
  previewMesh.position.set(0, 18, 0);
  previewMesh.userData.fruitName = fruitName;
  previewMesh.renderOrder = 1;
  previewMesh.castShadow = true;
  scene.add(previewMesh);

  createFaceDecals(previewMesh, fruitName, faceMaterials, { yaw: 0 });

  previewGuideLine = createDropGuide();
}

updatePreviewMesh();
updateNextFruitHud();

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
    const previewRadius = previewMesh.geometry.parameters.radius;
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

  updateNextFruitHud();

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
  if (spawnDelayEnabled && (performance.now() - lastDropTime < 700)) return;

  const fruitIndex = currentFruitIndex;
  const fruitName = fruitOrder[fruitIndex];

  const geometry = sphereGeometries[fruitIndex];
  const radius = geometry.parameters.radius;

  const mat = fruitMaterials[fruitName];
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.renderOrder = 1;
  mesh.material.depthWrite = true;
  mesh.userData.fruitName = fruitName;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

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
  currentFruitIndex = nextFruitIndex;
  nextFruitIndex = Math.floor(Math.random() * 5);

  updatePreviewMesh();
  updateNextFruitHud();

  // snap to pointer
  raycaster.setFromCamera(pointer, camera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);
  if (target && previewMesh) {
    const previewRadius = previewMesh.geometry.parameters.radius;
    clampPreviewToCup(target, previewRadius);
    previewMesh.position.copy(target);
    previewMesh.position.y = planeHeight;
  }
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') spawnFruit();

  const dist = 35;
  const h = 15;

  switch (event.key.toLowerCase()) {
    case 'd':
      spawnDelayEnabled = !spawnDelayEnabled;
      break;
    case 'p':
      showPlanes = !showPlanes;
      break;
    case 't':
      camera.position.set(0, 45, 0.1); // top view
      controls.update();
      break;
    case 'f':
      camera.position.set(0, h, dist); // front view
      controls.update();
      break;
    case 'b':
      camera.position.set(0, h, -dist); // back view
      controls.update();
      break;
    case 'l':
      camera.position.set(-dist, h, 0); // left view
      controls.update();
      break;
    case 'r':
      camera.position.set(dist, h, 0); // right view
      controls.update();
      break;
  }
});

window.addEventListener('resize', () => {
  nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  nextRenderer.setSize(110, 110);
  nextCamera.aspect = 1;
  nextCamera.updateProjectionMatrix();

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let blinkTime = 0;

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

  let maxFruitHeight = cup.position.y + cup.userData.cup.bottom; // baseline
  const cupData = cup.userData.cup;
  const cupOpeningY = cup.position.y + cupData.height;
  const cupMaxSafeWaitY = cup.position.y + cupData.bottom + (cupData.height - cupData.bottom) * 0.80; // 4/5ths height
  fallingFruits.forEach((f) => {
    if (!f.mesh) return;
    const topY = f.pos.y + f.radius;
    if (topY > maxFruitHeight) {
      maxFruitHeight = topY;
    }
  });

  if (showPlanes && maxFruitHeight > cup.position.y + cupData.bottom + 0.5) {
    highestFruitPlane.visible = true;
    highestFruitPlane.position.y = maxFruitHeight;
    const t = Math.max(0, Math.min(1, (maxFruitHeight - cup.position.y - cupData.bottom) / (cupData.height - cupData.bottom)));
    const currRadius = cupData.innerBottomR + t * (cupData.innerTopR - cupData.innerBottomR);
    highestFruitPlane.scale.setScalar(currRadius / (cupData.innerTopR - 0.2));
  } else {
    highestFruitPlane.visible = false;
  }

  if (showPlanes && maxFruitHeight >= cupMaxSafeWaitY) {
    blinkTime += dt * 5;
    const alpha = (Math.sin(blinkTime) + 1.0) / 2.0 * 0.8 + 0.1;
    dangerMat.opacity = alpha;
  } else {
    blinkTime = 0;
    dangerMat.opacity = 0;
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

  if (nextFruitMesh) {
    nextFruitMesh.rotation.y += 0.01;
    nextFruitMesh.rotation.x = -0.18;
    nextRenderer.render(nextScene, nextCamera);
  }

  controls.update();

  renderer.autoClear = false;

  // Rendering MAIN view
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(true);
  renderer.clear();
  renderer.render(scene, camera);

  // Rendering MINI view
  const miniSize = 250;
  const padding = 20;
  renderer.setViewport(window.innerWidth - miniSize - padding, padding, miniSize, miniSize);
  renderer.setScissor(window.innerWidth - miniSize - padding, padding, miniSize, miniSize);
  renderer.setScissorTest(true);

  // Clear the mini viewport only, not the whole screen
  renderer.clearDepth();
  renderer.render(scene, miniCamera);
}

renderer.setAnimationLoop(animate);
