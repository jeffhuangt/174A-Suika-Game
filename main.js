import * as THREE from 'three';
import { setupScene } from './setupScene.js';
import { createFruitsTextures } from './fruitTextures.js';
import { createFaceDecals } from './faceDecals.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { merge } from './merge.js';

const { scene, camera, renderer, controls } = setupScene();
const { fruitMaterials, faceMaterials, fruitOrder } = createFruitsTextures(renderer);

const GRAVITY = -25;
const RESTITUTION_TABLE = 0.25 // bounce on table
const FRICTION_TABLE = 0.15 //horizontal slowdown on table hit
const LINEAR_DAMPING = 0.995; // global damping each frame
const SETTLE_SPEED = 0.08; // below this, fruit is consider to be at rest
const FRUIT_COLLIDE_EPS = 0.001; // penetration tolerance for fruit-fruit
const ANGULAR_DAMPING = 0.97; // when in air, spin decays
const COLLISION_SPIN = 0.35; // how much collision impulse becomes rotation

const ROLLING_GRIP = 12.0;
const SPIN_TRANSFER = 0.015;


const timer = new THREE.Timer();
const fallingFruits = [];
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

      const normx = dx / dist;
      const normy = dy / dist;
      const normz = dz / dist;
      // push apart the mass
      const overlap = minDist - dist;
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
      // no collision
      if (vn >= 0){
        continue;
      }

      const jMag = -(1 + RESTITUTION_FRUIT) * vn / (1 / a.mass + 1 / b.mass);
      a.vel.x += (jMag / a.mass) * normx;
      a.vel.y += (jMag / a.mass) * normy;
      a.vel.z += (jMag / a.mass) * normz;
      b.vel.x -= (jMag / b.mass) * normx;
      b.vel.y -= (jMag / b.mass) * normy;
      b.vel.z -= (jMag / b.mass) * normz;

      // Spin from collision (tangential effect of impact)
      if (!a.angularVel) a.angularVel = new THREE.Vector3(0, 0, 0);
      if (!b.angularVel) b.angularVel = new THREE.Vector3(0, 0, 0);
      const spinA = (jMag / a.mass) * COLLISION_SPIN / a.radius;
      const spinB = (jMag / b.mass) * COLLISION_SPIN / b.radius;
      a.angularVel.x += normz * spinA;
      a.angularVel.z -= normx * spinA;
      b.angularVel.x -= normz * spinB;
      b.angularVel.z += normx * spinB;
    }
  }
}

window.addEventListener('pointermove', onPointerMove);

function spawnFruit() {
  if (!previewMesh) return;
  if(activeFruit && !fallingFruits.includes(activeFruit)) {
    activeFruit = null;
  }
  // if (activeFruit && !activeFruit.isSettled) return;

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
    radius,
    pos: mesh.position.clone(),
    vel: new THREE.Vector3(0, 0, 0),
    mass: radius * radius,
    isSettled: false,
    angularVel: new THREE.Vector3(0, 0, 0),
    quat: new THREE.Quaternion(),
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

    // gravity
    f.vel.y  += GRAVITY * dt;
    f.pos.addScaledVector(f.vel, dt);

    cupWallCollision(f);

    const cupData = cup.userData.cup;
    const cupBaseY = cup.position.y;
    const cupInnerBottomY = cupBaseY + cupData.bottom;

    const dx = f.pos.x - cup.position.x;
    const dz = f.mesh.position.z - cup.position.z; // keep z fixed for now
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

      f.vel.x *= (1 - FRICTION_TABLE);
      f.vel.z *= (1 - FRICTION_TABLE);

      if (Math.abs(f.vel.y) < SETTLE_SPEED) {
        f.vel.y = 0;
        f.isSettled = true;

        if (activeFruit === f) {
          activeFruit = null;
        }
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

      f.vel.x *= (1 - FRICTION_TABLE);
      f.vel.z *= (1 - FRICTION_TABLE);

      if (Math.abs(f.vel.y) < SETTLE_SPEED) {
        f.vel.y = 0;
        f.isSettled = true;

        if (activeFruit === f) {
          activeFruit = null;
        }
      }
    } else {
      f.isSettled = false;
      // In air: damp angular velocity (no rolling constraint)
      if (f.angularVel) f.angularVel.multiplyScalar(ANGULAR_DAMPING);
    }

    // damping
    f.vel.multiplyScalar(LINEAR_DAMPING);

    f.mesh.position.copy(f.pos);

    // Quaternion-based rotation — no gimbal lock
    if (!f.angularVel) f.angularVel = new THREE.Vector3(0, 0, 0);
    if (!f.quat) { f.quat = new THREE.Quaternion(); f.quat.copy(f.mesh.quaternion); }
    const angle = f.angularVel.length() * dt;
    if (angle > 1e-7) {
      const axis = f.angularVel.clone().normalize();
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      f.quat.premultiply(deltaQ);
      f.quat.normalize();
      f.mesh.quaternion.copy(f.quat);
    }

    const onGround = (overCupOpening && f.pos.y - f.radius <= cupInnerBottomY + 0.01)
                   || (f.pos.y - f.radius <= tableTopY + 0.01);
    if (!onGround) {
      f.angularVel.multiplyScalar(ANGULAR_DAMPING); // free-spin decay in air
    }
  }

  merge({ scene, fallingFruits, fruitOrder, sphereGeometries, fruitMaterials, faceMaterials, createFaceDecals, });
  
  if(activeFruit && !fallingFruits.includes(activeFruit)) {
    activeFruit = null;
  }

  controls.update();
  renderer.render(scene, camera);

}

renderer.setAnimationLoop(animate);