import * as THREE from 'three';
import { setupScene } from './setupScene.js';
import { createFruitsTextures } from './fruitTextures.js';
import { createFaceDecals } from './faceDecals.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { merge } from './merge.js';

const { scene, camera, renderer, controls } = setupScene();
const { fruitMaterials, faceMaterials, fruitOrder } = createFruitsTextures(renderer);

const GRAVITY = -25;
const RESTITUTION_TABLE = 0.25; // bounce on table
const RESTITUTION_FRUIT = 0.4; // fruit-fruit bounce
const FRICTION_TABLE = 0.15; // horizontal slowdown on table hit
const LINEAR_DAMPING = 0.995; // global damping each frame
const FRUIT_COLLIDE_EPS = 0.001; // penetration tolerance for fruit-fruit
const SLEEP_SPEED = 0.03;
const SLEEP_FRAMES = 20;
const POSITION_EPS = 0.0005;
const COLLISION_PASSES = 15;
const TOP_OUT_LIMIT = 2.0; // seconds above rime before losing

const SETTLE_SPEED = 0.08; // below this, fruit is consider to be at rest
const ANGULAR_DAMPING = 0.97; // when in air, spin decays
const COLLISION_SPIN = 0.35; // how much collision impulse becomes rotation

const ROLLING_GRIP = 12.0;
const SPIN_TRANSFER = 0.015;


const timer = new THREE.Timer();
const fallingFruits = [];
let activeFruit = null;

let gameOver = false;
let topOutTime = 0;

let score = 0;
const fruitScores = {
  cherry: 1,
  strawberry: 3,
  grape: 6,
  orange: 10,
  persimmon: 15,
  apple: 21,
  pear: 28,
  peach: 36,
  pineapple: 45,
  melon: 55,
  watermelon: 66,
}

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

let bestScore = Number(localStorage.getItem('suikaBestScore') || 0);

const scoreHud = document.createElement('div');
scoreHud.style.position = 'fixed';
scoreHud.style.top = '18px';
scoreHud.style.left = '18px';
scoreHud.style.width = '170px';
scoreHud.style.height = '170px';
scoreHud.style.borderRadius = '50%';
scoreHud.style.zIndex = '99999';
scoreHud.style.pointerEvents = 'none';
scoreHud.style.display = 'flex';
scoreHud.style.flexDirection = 'column';
scoreHud.style.alignItems = 'center';
scoreHud.style.justifyContent = 'center';
scoreHud.style.fontFamily = `'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif`;
scoreHud.style.color = '#145caa';
scoreHud.style.background = `
  radial-gradient(circle at 32% 28%,
    rgba(255,255,255,0.96) 0%,
    rgba(240,248,255,0.82) 10%,
    rgba(214,233,248,0.56) 24%,
    rgba(184,214,236,0.34) 54%,
    rgba(150,192,224,0.22) 78%,
    rgba(120,170,210,0.16) 100%)
`;
scoreHud.style.border = '3px solid rgba(255,255,255,0.55)';
scoreHud.style.boxShadow = `
  inset 0 10px 18px rgba(255,255,255,0.72),
  inset 0 -10px 18px rgba(90,140,185,0.18),
  0 4px 12px rgba(40,90,130,0.12)
`;

const bubbleHighlight1 = document.createElement('div');
bubbleHighlight1.style.position = 'absolute';
bubbleHighlight1.style.width = '34px';
bubbleHighlight1.style.height = '20px';
bubbleHighlight1.style.top = '26px';
bubbleHighlight1.style.left = '24px';
bubbleHighlight1.style.borderRadius = '50%';
bubbleHighlight1.style.background = 'rgba(255,255,255,0.78)';
bubbleHighlight1.style.transform = 'rotate(-28deg)';
bubbleHighlight1.style.filter = 'blur(1px)';

const bubbleHighlight2 = document.createElement('div');
bubbleHighlight2.style.position = 'absolute';
bubbleHighlight2.style.width = '24px';
bubbleHighlight2.style.height = '14px';
bubbleHighlight2.style.right = '24px';
bubbleHighlight2.style.bottom = '28px';
bubbleHighlight2.style.borderRadius = '50%';
bubbleHighlight2.style.background = 'rgba(255,255,255,0.62)';
bubbleHighlight2.style.transform = 'rotate(28deg)';
bubbleHighlight2.style.filter = 'blur(1px)';

const scoreTitle = document.createElement('div');
scoreTitle.textContent = 'Score';
scoreTitle.style.fontSize = '26px';
scoreTitle.style.fontWeight = '800';
scoreTitle.style.lineHeight = '1';
scoreTitle.style.marginBottom = '8px';
scoreTitle.style.textShadow = '0 2px 0 rgba(255,255,255,0.8), 0 0 4px rgba(0,0,0,0.18)';

const scoreValue = document.createElement('div');
scoreValue.textContent = `${score}`;
scoreValue.style.fontSize = '54px';
scoreValue.style.fontWeight = '900';
scoreValue.style.lineHeight = '1';
scoreValue.style.marginBottom = '10px';
scoreValue.style.textShadow = '0 2px 0 rgba(255,255,255,0.8), 0 0 6px rgba(0,0,0,0.18)';

const bestLabel = document.createElement('div');
bestLabel.textContent = 'BEST SCORE';
bestLabel.style.fontSize = '14px';
bestLabel.style.fontWeight = '800';
bestLabel.style.letterSpacing = '0.5px';
bestLabel.style.opacity = '0.72';
bestLabel.style.lineHeight = '1';

const bestValue = document.createElement('div');
bestValue.textContent = `${bestScore}`;
bestValue.style.fontSize = '18px';
bestValue.style.fontWeight = '900';
bestValue.style.marginTop = '4px';
bestValue.style.lineHeight = '1';
bestValue.style.textShadow = '0 1px 0 rgba(255,255,255,0.8)';

scoreHud.appendChild(bubbleHighlight1);
scoreHud.appendChild(bubbleHighlight2);
scoreHud.appendChild(scoreTitle);
scoreHud.appendChild(scoreValue);
scoreHud.appendChild(bestLabel);
scoreHud.appendChild(bestValue);
document.body.appendChild(scoreHud);

function addScore(points) {
  score += points;
  scoreValue.textContent = `${score}`;

  if (score > bestScore) {
    bestScore = score;
    bestValue.textContent = `${bestScore}`;
    localStorage.setItem('suikaBestScore', String(bestScore));
  }
}

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

const cup = makeCup({ height: 30, wall:0.15, bottom: 0.25 });
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

const planeHeight = 25;
const planeLength = 25;
const maxFruitIndex = 5;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);

let nextFruitIndex = Math.floor(Math.random() * maxFruitIndex);
let previewMesh = null;
let previewGuideLine = null;

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

function updatePreviewMesh() {
  if (gameOver) {
    clearPreview();
    return;
  }
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
  material.depthWrite = true;

  previewMesh = new THREE.Mesh(geometry, material);
  previewMesh.position.set(0, 25, 0);
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function innerRadiusAtY(cupData, yLocal) {
  const t = clamp((yLocal - cupData.bottom) / (cupData.height - cupData.bottom), 0, 1);
  return cupData.innerBottomR + t * (cupData.innerTopR - cupData.innerBottomR);
}

function cupWallCollision(f) {
  const cupData = cup.userData.cup;

  const cupBaseY = cup.position.y;
  const yLocal = f.pos.y - cupBaseY;

  if (yLocal < cupData.bottom || yLocal > cupData.height) return;

  const innerR = innerRadiusAtY(cupData, yLocal);
  const allowedR = innerR - f.radius;

  const dx = f.pos.x - cup.position.x;
  const dz = f.pos.z - cup.position.z;

  const r = Math.hypot(dx, dz);

  if (r <= allowedR || r < 1e-6) return;

  // wall normals
  const nx = dx / r;
  const nz = dz / r;

  // push fruit back inside
  const correctedR = allowedR + 0.001;

  f.pos.x = cup.position.x + nx * correctedR;
  f.pos.z = cup.position.z + nz * correctedR;

  const v = f.vel;

  const vn = v.x * nx + v.z * nz;

  if (vn > 0) return;

  v.x -= (1 + 0.25) * vn * nx;
  v.z -= (1 + 0.25) * vn * nz;

  // spin from wall impact (axis = wall normal × up)
  if (!f.angularVel) f.angularVel = new THREE.Vector3(0, 0, 0);
  const wallSpin = (Math.abs(vn) * COLLISION_SPIN) / f.radius;
  f.angularVel.x += nz * wallSpin;
  f.angularVel.z -= nx * wallSpin;

  // wall friction
  v.x *= 0.92;
  v.z *= 0.92;
}

function resolveFruitFruitCollisions(fruits) {
  const n = fruits.length;

  for (let i = 0; i < n; i++) {
    const a = fruits[i];
    if (!a.mesh) continue;

    for (let j = i + 1; j < n; j++) {
      const b = fruits[j];
      if (!b.mesh) continue;

      const dx = a.pos.x - b.pos.x;
      const dy = a.pos.y - b.pos.y;
      const dz = a.pos.z - b.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      const minDist = a.radius + b.radius + FRUIT_COLLIDE_EPS;

      if (dist >= minDist || dist < 1e-9){
        continue;
      }

      a.isSettled = false;
      b.isSettled = false;
      a.sleepFrames = 0;
      b.sleepFrames = 0;

      const normx = dx / dist;
      const normy = dy / dist;
      const normz = dz / dist;

      // push apart the mass
      const overlap = Math.max(0, minDist - dist - 0.0005);
      const totalMass = a.mass + b.mass;
      const ratioA = b.mass / totalMass;
      const ratioB = a.mass / totalMass;
      
      a.pos.x += normx * overlap * ratioA;
      a.pos.y += normy * overlap * ratioA;
      a.pos.z += normz * overlap * ratioA;
      
      b.pos.x -= normx * overlap * ratioB;
      b.pos.y -= normy * overlap * ratioB;
      b.pos.z -= normz * overlap * ratioB;

      // calculate the impulse
      const vRelX = a.vel.x - b.vel.x;
      const vRelY = a.vel.y - b.vel.y;
      const vRelZ = a.vel.z - b.vel.z;
      const vn = vRelX * normx + vRelY * normy + vRelZ * normz;

      if (Math.abs(normy) > 0.6) {
        if (a.pos.y > b.pos.y) {
          a.hasSupport = true;
        } else {
          b.hasSupport = true;
        }
      }

      // no collision
      if (vn >= 0){
        continue;
      }

      if (vn > -1.0) {
        const invMassSum = (1 / a.mass) + (1 / b.mass);
        const jRest = -vn / invMassSum;

        a.vel.x += (jRest / a.mass) * normx;
        a.vel.y += (jRest / a.mass) * normy;
        a.vel.z += (jRest / a.mass) * normz;
        
        b.vel.x -= (jRest / b.mass) * normx;
        b.vel.y -= (jRest / b.mass) * normy;
        b.vel.z -= (jRest / b.mass) * normz;

        continue;
      }

      // wake up and bounce fruit if involved large impact
      a.isSettled = false;
      b.isSettled = false;

      const jMag = -(1 + RESTITUTION_FRUIT) * vn / ((1 / a.mass) + (1 / b.mass));
      
      a.vel.x += (jMag / a.mass) * normx;
      a.vel.y += (jMag / a.mass) * normy;
      a.vel.z += (jMag / a.mass) * normz;
      
      b.vel.x -= (jMag / b.mass) * normx;
      b.vel.y -= (jMag / b.mass) * normy;
      b.vel.z -= (jMag / b.mass) * normz;
    }
  }
}

function clearPreview() {
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
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

  for (const f of fallingFruits) {
    if (!f.mesh) continue;

    // any part of the fruit above the rim
    if (f.pos.y + f.radius > cupOpeningY) {
      return true;
    }
  }

  return false;
}

window.addEventListener('pointermove', onPointerMove);

function spawnFruit() {
  if(gameOver || !previewMesh) return;
  if(activeFruit && !fallingFruits.includes(activeFruit)) {
    activeFruit = null;
  }
  if (activeFruit) return;

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
    hasSupport: false,
    lastY: mesh.position.y,
    stableFrames: 0,
    age: 0,
    dropUnlocked: false,
    sleepFrames: 0,
    prevPos: mesh.position.clone(),
    angularVel: new THREE.Vector3(0, 0, 0),
    quat: new THREE.Quaternion(),
  }

  fallingFruits.push(fruitObj);
  activeFruit = fruitObj;

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

function isFruitSupported(f, fruits, cup, tableTopY) {
  const cupData = cup.userData.cup;
  const cupBaseY = cup.position.y;
  const cupInnerBottomY = cupBaseY + cupData.bottom;

  const dxCup = f.pos.x - cup.position.x;
  const dzCup = f.pos.z - cup.position.z;
  const rXZ = Math.hypot(dxCup, dzCup);
  const overCupOpening = rXZ <= (cupData.innerTopR - f.radius);

  // table or cup bottom
  if (f.pos.y - f.radius <= tableTopY + 0.08) return true;
  if (overCupOpening && f.pos.y - f.radius <= cupInnerBottomY + 0.08) return true;

  // another fruit
  for (const other of fruits) {
    if (other === f || !other.mesh) continue;

    const dx = f.pos.x - other.pos.x;
    const dy = f.pos.y - other.pos.y;
    const dz = f.pos.z - other.pos.z;
    const dist = Math.hypot(dx, dy, dz);
    const minDist = f.radius + other.radius;

    if (dist <= minDist + 0.12 && dy > -0.02) {
      return true;
    }
  }

  return false;
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

  for (const f of fallingFruits) {
    if (!f.mesh) continue;
    f.hasSupport = false;
  }

  // physics part
  for (const f of fallingFruits) {
    if (!f.mesh || f.isSettled) continue;
    // gravity
    f.vel.y += GRAVITY * dt;
    f.pos.addScaledVector(f.vel, dt);
  }

  for (let pass = 0; pass < COLLISION_PASSES; pass++) {
    resolveFruitFruitCollisions(fallingFruits);

    for (const f of fallingFruits) {
      if (!f.mesh) continue;

      const cupData = cup.userData.cup;
      const cupInnerBottomY = cup.position.y + cupData.bottom;
      const dx = f.pos.x - cup.position.x;
      const dz = f.pos.z - cup.position.z;
      const rXZ = Math.hypot(dx, dz);
      const overCupOpening = rXZ <= (cupData.innerTopR - f.radius);

      if (overCupOpening && f.pos.y - f.radius < cupInnerBottomY) {
        f.pos.y = cupInnerBottomY + f.radius;
      } else if (f.pos.y - f.radius < tableTopY) {
        f.pos.y = tableTopY + f.radius;
      }
    }
  }

  for (const f of fallingFruits) {
    if (!f.mesh) continue;

    if (f.isSettled) {
      f.mesh.position.copy(f.pos);
      continue;
    }

    cupWallCollision(f);

    const cupData = cup.userData.cup;
    const cupBaseY = cup.position.y;
    const cupInnerBottomY = cupBaseY + cupData.bottom;

    const dx = f.pos.x - cup.position.x;
    const dz = f.pos.z - cup.position.z;
    const rXZ = Math.hypot(dx, dz);
    const overCupOpening = rXZ <= (cupData.innerTopR - f.radius);

    // settle on cup bottom first if over cup opening
    if (overCupOpening && f.pos.y - f.radius <= cupInnerBottomY) {
      f.pos.y = cupInnerBottomY + f.radius  + 0.001;

      // Enforce rolling constraint gradually (no-slip friction)
      if (!f.angularVel) f.angularVel = new THREE.Vector3(0, 0, 0);
      // Target ω for pure rolling: ω = (n × v) / r, n = (0,1,0)
      const targetOmegaX = f.vel.z / f.radius;
      const targetOmegaZ = -f.vel.x / f.radius;
      const grip = Math.min(1.0, ROLLING_GRIP * dt);
      f.angularVel.x += (targetOmegaX - f.angularVel.x) * grip;
      f.angularVel.z += (targetOmegaZ - f.angularVel.z) * grip;
      // Spin-to-velocity: surface spin nudges the fruit forward
      f.vel.x += (f.angularVel.z * -f.radius - f.vel.x) * SPIN_TRANSFER;
      f.vel.z += (f.angularVel.x *  f.radius - f.vel.z) * SPIN_TRANSFER;
      f.angularVel.y *= 0.92; // bleed off top-spin gradually
      
      if (f.vel.y < 0) {
        f.vel.y = -f.vel.y * RESTITUTION_TABLE;
      }

      // reduce speed of fruits with friction
      const sCup = Math.hypot(f.vel.x, f.vel.z);
      if (sCup > 1e-9) {
        const deltaV = FRICTION_TABLE * Math.abs(GRAVITY) * dt;
        const reduce = Math.min(deltaV, sCup);
        f.vel.x -= (f.vel.x / sCup) * reduce;
        f.vel.z -= (f.vel.z / sCup) * reduce;
      }
    } else if (f.pos.y - f.radius <= tableTopY) { // collide with table top
      f.pos.y = tableTopY + f.radius + 0.001;

      // Set rolling from velocity immediately (before bounce/friction) so no delay
      if (!f.angularVel) f.angularVel = new THREE.Vector3(0, 0, 0);
      f.angularVel.x = f.vel.z / f.radius;
      f.angularVel.y = 0;
      f.angularVel.z = -f.vel.x / f.radius;
      
      if (f.vel.y < 0) {
        f.vel.y = -f.vel.y * RESTITUTION_TABLE;
      }

      // reduce speed of fruits with friction on table
      const sTable = Math.hypot(f.vel.x, f.vel.z);
      if (sTable > 1e-9) {
        const deltaV = FRICTION_TABLE * Math.abs(GRAVITY) * dt;
        const reduce = Math.min(deltaV, sTable);
        f.vel.x -= (f.vel.x / sTable) * reduce;
        f.vel.z -= (f.vel.z / sTable) * reduce;
      }
    }

    // damping
    f.vel.multiplyScalar(LINEAR_DAMPING);
    f.mesh.position.copy(f.pos);

    const frameMove = f.pos.distanceTo(f.prevPos);
    const speed = f.vel.length();
    const supported = isFruitSupported(f, fallingFruits, cup, tableTopY);

    if (supported && speed < SLEEP_SPEED && frameMove < POSITION_EPS) {
      f.sleepFrames += 1;
    } else {
      f.sleepFrames = 0;
    }

    if (f.sleepFrames >= SLEEP_FRAMES) {
        f.isSettled = true;
        f.vel.set(0, 0, 0);
      } else {
        f.isSettled = false;
      }

      f.prevPos.copy(f.pos);
  }

  if (activeFruit && activeFruit.mesh) {
    activeFruit.age += dt;

    const supported = isFruitSupported(activeFruit, fallingFruits, cup, tableTopY);
    const dyFrame = Math.abs(activeFruit.pos.y - activeFruit.lastY);

    if (supported && dyFrame < 0.01) {
      activeFruit.stableFrames += 1;
    } else {
      activeFruit.stableFrames = 0;
    }

    activeFruit.lastY = activeFruit.pos.y;

    // only unlock spawning; do NOT freeze physics here
    if (!activeFruit.dropUnlocked && (
      activeFruit.stableFrames >= 6 ||
      (supported && activeFruit.age > 0.35)
    )) {
      activeFruit.dropUnlocked = true;
      activeFruit = null;
    }
  }

  merge({ scene, fallingFruits, fruitOrder, sphereGeometries, fruitMaterials, faceMaterials, createFaceDecals, fruitScores, addScore, mergeSound });

  if (!gameOver) {
    if (hasFruitAboveOpening()) {
      topOutTime += dt;

      if (topOutTime >= TOP_OUT_LIMIT) {
        gameOver = true;
        activeFruit = null;
        clearPreview();
      }
    } else {
      topOutTime = 0;
    }
  }
  
  if(activeFruit && !fallingFruits.includes(activeFruit)) {
    activeFruit = null;
  }

  controls.update();
  renderer.render(scene, camera);

}

renderer.setAnimationLoop(animate);