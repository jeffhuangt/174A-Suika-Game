import * as THREE from 'three';
import { setupScene } from './setupScene.js';
import { createFruitsTextures } from './fruitTextures.js';
import { createFaceDecals } from './faceDecals.js';
import { merge } from './merge.js';

const { scene, camera, renderer, controls } = setupScene();
const { fruitMaterials, faceMaterials, fruitOrder } = createFruitsTextures(renderer);


const timer = new THREE.Timer();
const fallingFruits = [];
const GRAVITY = -25;

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

const tableBox = new THREE.Box3();

scene.add(table);


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

const planeHeight = 20;
const planeLength = 25;
const maxFruitIndex = 4;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);

let nextFruitIndex = Math.floor(Math.random() * maxFruitIndex);
let previewMesh = null;

function updatePreviewMesh() {
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
    previewMesh.material.dispose();
  }

  const fruitName = fruitOrder[nextFruitIndex];
  const geometry = sphereGeometries[nextFruitIndex];
  const material = fruitMaterials[fruitName].clone();
  material.transparent = true;
  material.opacity = 0.5;

  previewMesh = new THREE.Mesh(geometry, material);
  previewMesh.position.set(0, 25, 0);
  scene.add(previewMesh);

  createFaceDecals(previewMesh, fruitName, faceMaterials, { yaw: 0 });
}

updatePreviewMesh();

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);

  if (target) {
    const limit = planeLength / 2;
    target.x = Math.max(-limit, Math.min(limit, target.x));
    target.z = Math.max(-limit, Math.min(limit, target.z));
    target.y = 25;

    if (previewMesh) {
      previewMesh.position.copy(target);
    }
  }
}

window.addEventListener('pointermove', onPointerMove);

function spawnFruit() {
  if (!previewMesh) return;

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

  fallingFruits.push({ mesh, velocityY: 0, radius });

  // update next fruit
  nextFruitIndex = Math.floor(Math.random() * 5);
  updatePreviewMesh();

  // snap to pointer
  raycaster.setFromCamera(pointer, camera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);
  if (target && previewMesh) {
    const limit = planeLength / 2;
    target.x = Math.max(-limit, Math.min(limit, target.x));
    target.z = Math.max(-limit, Math.min(limit, target.z));
    previewMesh.position.copy(target);
    previewMesh.position.y = planeHeight;
  }
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') spawnFruit();
});

function animate() {

  timer.update();

  const dt = Math.min(timer.getDelta(), 0.033);

  tableBox.setFromObject(table);
  const tableTopY = tableBox.max.y;

  // physics part
  for (const f of fallingFruits) {
    f.velocityY += GRAVITY * dt;
    f.mesh.position.y += f.velocityY * dt;

    // collide with table top
    if (f.mesh.position.y - f.radius <= tableTopY) {
      f.mesh.position.y = tableTopY + f.radius;
      f.velocityY = 0;
    }
  }

  merge({ scene, fallingFruits, fruitOrder, sphereGeometries, fruitMaterials, faceMaterials, createFaceDecals, });

  controls.update();
  renderer.render(scene, camera);

}

renderer.setAnimationLoop(animate);