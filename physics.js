import * as THREE from 'three';
import {
  GRAVITY, RESTITUTION_TABLE, RESTITUTION_FRUIT, FRICTION_TABLE,
  LINEAR_DAMPING, FRUIT_COLLIDE_EPS, SLEEP_SPEED, SLEEP_FRAMES,
  POSITION_EPS, COLLISION_PASSES, COLLISION_SPIN, ROLLING_GRIP, SPIN_TRANSFER,
} from './constants.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function innerRadiusAtY(cupData, yLocal) {
  const t = clamp((yLocal - cupData.bottom) / (cupData.height - cupData.bottom), 0, 1);
  return cupData.innerBottomR + t * (cupData.innerTopR - cupData.innerBottomR);
}

export function cupWallCollision(f, cup) {
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

export function resolveFruitFruitCollisions(fruits) {
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

export function isFruitSupported(f, fruits, cup, tableTopY) {
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

export function stepPhysics(fallingFruits, cup, tableTopY, dt) {
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

    cupWallCollision(f, cup);

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
}
