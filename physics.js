import * as THREE from 'three';
import {
  GRAVITY, RESTITUTION_TABLE, RESTITUTION_FRUIT, RESTITUTION_WALL,
  FRICTION_TABLE, FRICTION_WALL, LINEAR_DAMPING, ANGULAR_DAMPING,
  FRUIT_COLLIDE_EPS, SLEEP_SPEED, SLEEP_FRAMES, POSITION_EPS,
  COLLISION_PASSES, MAX_ANGULAR_SPEED,
} from './constants.js';

// reused every frame to avoid allocating new objects
const _spinAxis = new THREE.Vector3();
const _spinQuat = new THREE.Quaternion();

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function innerRadiusAtY(cupData, yLocal) {
  const t = clamp((yLocal - cupData.bottom) / (cupData.height - cupData.bottom), 0, 1);
  return cupData.innerBottomR + t * (cupData.innerTopR - cupData.innerBottomR);
}

// keeps fruits inside the cup — pushes them back in and bounces velocity
function cupWallConstraint(f, cup) {
  const cupData = cup.userData.cup;
  const yLocal = f.pos.y - cup.position.y;

  if (yLocal < cupData.bottom || yLocal > cupData.height) return false;

  const innerR = innerRadiusAtY(cupData, yLocal);
  const allowedR = innerR - f.radius;

  const dx = f.pos.x - cup.position.x;
  const dz = f.pos.z - cup.position.z;
  const r = Math.hypot(dx, dz);

  if (r <= allowedR || r < 1e-6) return false;

  const nx = dx / r;
  const nz = dz / r;

  f.pos.x = cup.position.x + nx * (allowedR - 0.001);
  f.pos.z = cup.position.z + nz * (allowedR - 0.001);

  const vn = f.vel.x * nx + f.vel.z * nz;
  if (vn > 0) return true;

  f.vel.x -= (1 + RESTITUTION_WALL) * vn * nx;
  f.vel.z -= (1 + RESTITUTION_WALL) * vn * nz;

  // slow down the part of velocity sliding along the wall
  const tx = f.vel.x - (f.vel.x * nx + f.vel.z * nz) * nx;
  const tz = f.vel.z - (f.vel.x * nx + f.vel.z * nz) * nz;
  const tMag = Math.hypot(tx, tz);
  if (tMag > 1e-9) {
    const frictionImpulse = Math.min(FRICTION_WALL * Math.abs(vn), tMag);
    f.vel.x -= (tx / tMag) * frictionImpulse;
    f.vel.z -= (tz / tMag) * frictionImpulse;
  }

  return true;
}

// pushes overlapping fruits apart and bounces their velocities
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

      if (dist >= minDist || dist < 1e-9) continue;

      a.isSettled = false;
      b.isSettled = false;
      a.sleepFrames = 0;
      b.sleepFrames = 0;

      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      const overlap = Math.max(0, minDist - dist);
      const totalMass = a.mass + b.mass;
      const ratioA = b.mass / totalMass;
      const ratioB = a.mass / totalMass;

      a.pos.x += nx * overlap * ratioA;
      a.pos.y += ny * overlap * ratioA;
      a.pos.z += nz * overlap * ratioA;

      b.pos.x -= nx * overlap * ratioB;
      b.pos.y -= ny * overlap * ratioB;
      b.pos.z -= nz * overlap * ratioB;

      const vRelX = a.vel.x - b.vel.x;
      const vRelY = a.vel.y - b.vel.y;
      const vRelZ = a.vel.z - b.vel.z;
      const vn = vRelX * nx + vRelY * ny + vRelZ * nz;

      if (vn >= 0) continue;

      const invMassSum = (1 / a.mass) + (1 / b.mass);
      const e = Math.abs(vn) < 1.0 ? 0.0 : RESTITUTION_FRUIT;
      const jMag = -(1 + e) * vn / invMassSum;

      a.vel.x += (jMag / a.mass) * nx;
      a.vel.y += (jMag / a.mass) * ny;
      a.vel.z += (jMag / a.mass) * nz;

      b.vel.x -= (jMag / b.mass) * nx;
      b.vel.y -= (jMag / b.mass) * ny;
      b.vel.z -= (jMag / b.mass) * nz;

      // friction so fruits don't slide past each other frictionlessly
      const vtx = vRelX - vn * nx;
      const vty = vRelY - vn * ny;
      const vtz = vRelZ - vn * nz;
      const vtMag = Math.hypot(vtx, vty, vtz);

      if (vtMag > 1e-6) {
        const frictionJ = Math.min(0.3 * jMag, vtMag / invMassSum);
        const ftx = (vtx / vtMag) * frictionJ;
        const fty = (vty / vtMag) * frictionJ;
        const ftz = (vtz / vtMag) * frictionJ;

        a.vel.x -= ftx / a.mass;
        a.vel.y -= fty / a.mass;
        a.vel.z -= ftz / a.mass;

        b.vel.x += ftx / b.mass;
        b.vel.y += fty / b.mass;
        b.vel.z += ftz / b.mass;
      }
    }
  }
}

export function isFruitSupported(f, fruits, cup, tableTopY) {
  const cupData = cup.userData.cup;
  const cupBaseY = cup.position.y;
  const cupInnerBottomY = cupBaseY + cupData.bottom;

  const dxCup = f.pos.x - cup.position.x;
  const dzCup = f.pos.z - cup.position.z;
  const rXZ = Math.hypot(dxCup, dzCup);
  const overCupOpening = rXZ <= (cupData.innerTopR - f.radius);

  if (f.pos.y - f.radius <= tableTopY + 0.08) return true;
  if (overCupOpening && f.pos.y - f.radius <= cupInnerBottomY + 0.08) return true;

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

function clampAngularVel(f) {
  const s = f.angularVel.length();
  if (s > MAX_ANGULAR_SPEED) {
    f.angularVel.multiplyScalar(MAX_ANGULAR_SPEED / s);
  }
}

export function stepPhysics(fallingFruits, cup, tableTopY, dt) {
  for (const f of fallingFruits) {
    if (!f.mesh) continue;
    f.hasSupport = false;
  }

  for (const f of fallingFruits) {
    if (!f.mesh || f.isSettled) continue;
    f.vel.y += GRAVITY * dt;
    f.pos.addScaledVector(f.vel, dt);
  }

  // run collision resolution multiple times so piled-up fruits settle properly
  for (let pass = 0; pass < COLLISION_PASSES; pass++) {
    resolveFruitFruitCollisions(fallingFruits);

    for (const f of fallingFruits) {
      if (!f.mesh) continue;

      cupWallConstraint(f, cup);

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

  // now handle surface contact, rolling, damping, and putting fruits to sleep
  const linDamp = Math.pow(LINEAR_DAMPING, dt * 60);
  const angDamp = Math.pow(ANGULAR_DAMPING, dt * 60);

  for (const f of fallingFruits) {
    if (!f.mesh) continue;

    if (f.isSettled) {
      f.mesh.position.copy(f.pos);
      continue;
    }

    if (!f.angularVel) f.angularVel = new THREE.Vector3(0, 0, 0);

    const cupData = cup.userData.cup;
    const cupInnerBottomY = cup.position.y + cupData.bottom;
    const dx = f.pos.x - cup.position.x;
    const dz = f.pos.z - cup.position.z;
    const rXZ = Math.hypot(dx, dz);
    const overCupOpening = rXZ <= (cupData.innerTopR - f.radius);
    const onCupFloor = overCupOpening && f.pos.y - f.radius <= cupInnerBottomY + 0.01;
    const onTable = !onCupFloor && f.pos.y - f.radius <= tableTopY + 0.01;

    if (onCupFloor) {
      f.pos.y = cupInnerBottomY + f.radius + 0.001;

      if (f.vel.y < 0) f.vel.y = -f.vel.y * RESTITUTION_TABLE;

      const hSpeed = Math.hypot(f.vel.x, f.vel.z);
      if (hSpeed > 1e-9) {
        const deltaV = FRICTION_TABLE * Math.abs(GRAVITY) * dt;
        const reduce = Math.min(deltaV, hSpeed);
        f.vel.x -= (f.vel.x / hSpeed) * reduce;
        f.vel.z -= (f.vel.z / hSpeed) * reduce;
      }

      // roll along the cup floor — spin matches movement speed
      f.angularVel.x = f.vel.z / f.radius;
      f.angularVel.y *= 0.9;
      f.angularVel.z = -f.vel.x / f.radius;
    } else if (onTable) {
      f.pos.y = tableTopY + f.radius + 0.001;

      if (f.vel.y < 0) f.vel.y = -f.vel.y * RESTITUTION_TABLE;

      const hSpeed = Math.hypot(f.vel.x, f.vel.z);
      if (hSpeed > 1e-9) {
        const deltaV = FRICTION_TABLE * Math.abs(GRAVITY) * dt;
        const reduce = Math.min(deltaV, hSpeed);
        f.vel.x -= (f.vel.x / hSpeed) * reduce;
        f.vel.z -= (f.vel.z / hSpeed) * reduce;
      }

      // roll along the table — spin matches movement speed
      f.angularVel.x = f.vel.z / f.radius;
      f.angularVel.y = 0;
      f.angularVel.z = -f.vel.x / f.radius;
    }

    f.vel.multiplyScalar(linDamp);
    f.angularVel.multiplyScalar(angDamp);
    clampAngularVel(f);

    // actually rotate the 3D model to match the spin
    const angSpeed = f.angularVel.length();
    if (angSpeed > 1e-6) {
      const angle = angSpeed * dt;
      _spinAxis.copy(f.angularVel).divideScalar(angSpeed);
      _spinQuat.setFromAxisAngle(_spinAxis, angle);
      f.mesh.quaternion.premultiply(_spinQuat);
    }

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
      f.angularVel.set(0, 0, 0);
    } else {
      f.isSettled = false;
    }

    f.prevPos.copy(f.pos);
  }
}
