// aircraft.js — the seaplane: a built-from-parts 3D model plus the arcade
// flight model (lift, drag, throttle, pitch, roll, yaw, stall, damage).
// The model is assembled from primitives so the aircraft looks built, not a blob.
import * as THREE from '../vendor/three.module.min.js';
import { AIRCRAFT, PALETTE, AIRSTRIPS } from './config.js';
import { groundHeight, stripAt } from './terrain.js';

/** Build the seaplane mesh. Returns { group, prop } — prop spins with throttle. */
export function buildPlaneMesh() {
  const group = new THREE.Group();
  group.name = 'seaplane';
  const white = new THREE.MeshStandardMaterial({ color: PALETTE.planeWhite, roughness: 0.5, metalness: 0.15 });
  const teal = new THREE.MeshStandardMaterial({ color: PALETTE.planeTeal, roughness: 0.45, metalness: 0.2 });
  const orange = new THREE.MeshStandardMaterial({ color: PALETTE.planeOrange, roughness: 0.5, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a3a4a, roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.7 });

  // Fuselage: a tapered body, nose forward (-z is forward in our model space).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), white);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 12), teal);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.6;
  group.add(nose);
  // Teal cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.6, 5.4, 12, 1, true, 0, Math.PI), teal);
  stripe.rotation.x = Math.PI / 2;
  stripe.rotation.y = Math.PI / 2;
  stripe.position.y = -0.12;
  group.add(stripe);

  // Cockpit canopy: a glass bubble with a frame.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), glass);
  canopy.scale.set(1, 0.85, 1.6);
  canopy.position.set(0, 0.55, -1.2);
  group.add(canopy);

  // High wing with a slight dihedral, plus orange wingtips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 1.9), white);
  wing.position.set(0, 0.95, -0.4);
  wing.rotation.z = 0; // dihedral faked by tip panels below
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 1.85), orange);
    tip.position.set(side * 5.2, 1.08, -0.4);
    tip.rotation.z = side * -0.06;
    group.add(tip);
    // Wing struts down to the floats.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6), dark);
    strut.position.set(side * 2.2, 0.1, -0.4);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: horizontal stabiliser + vertical fin with the courier's orange flash.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.2), white);
  tailplane.position.set(0, 0.35, 2.6);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.6), teal);
  fin.position.set(0, 1.0, 2.6);
  fin.rotation.x = -0.25;
  group.add(fin);
  const flash = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 1.0), orange);
  flash.position.set(0, 1.35, 2.75);
  flash.rotation.x = -0.25;
  group.add(flash);

  // Twin floats (she is a seaplane) with spreader bars.
  for (const side of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 4.2, 10), orange);
    float.rotation.x = Math.PI / 2;
    float.position.set(side * 1.1, -1.25, -0.3);
    group.add(float);
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.9), dark);
    step.position.set(side * 1.1, -1.5, 0.9);
    group.add(step);
  }

  // Propeller: spinner cone + three blades, spinning with throttle.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -4.5);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 10), orange);
  spinner.rotation.x = -Math.PI / 2;
  prop.add(spinner);
  for (let b = 0; b < 3; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.08), dark);
    blade.position.y = 0;
    const holder = new THREE.Group();
    holder.rotation.z = (b / 3) * Math.PI * 2;
    blade.position.y = 1.0;
    holder.add(blade);
    prop.add(holder);
  }
  // A faint translucent disc so the spinning prop reads at speed.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.95, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
  );
  prop.add(disc);
  group.add(prop);

  // Navigation lights: red left, green right, white tail.
  const mkLight = (color, x, y, z) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color }));
    l.position.set(x, y, z);
    group.add(l);
  };
  mkLight(0xff2222, -5.8, 1.0, -0.4);
  mkLight(0x22ff44, 5.8, 1.0, -0.4);
  mkLight(0xffffff, 0, 0.6, 3.0);

  return { group, prop };
}

export const FLIGHT = {
  PARKED: 'parked',
  FLYING: 'flying',
  CRASHED: 'crashed',
};

/** Create the aircraft's flight state, parked on Merdeka Field facing east. */
export function createAircraft() {
  const home = AIRSTRIPS[0];
  return {
    pos: new THREE.Vector3(home.x, home.elev + AIRCRAFT.gearHeight, home.z),
    heading: home.heading * Math.PI / 180, // radians, 0 = north (-z)
    pitch: 0, // radians, + = nose up
    roll: 0, // radians, + = bank right
    speed: 0,
    throttle: 0,
    fuel: AIRCRAFT.fuelCapacity,
    damage: 0,
    verticalSpeed: 0,
    flight: FLIGHT.PARKED,
    onGround: true,
    groundSpeed: 0,
    lastStrip: home,
    parkedTimer: 0,
    message: '',
  };
}

/** Reset the aircraft onto a strip (used after a ditch / crash respawn). */
export function placeOnStrip(ac, strip) {
  ac.pos.set(strip.x, strip.elev + AIRCRAFT.gearHeight, strip.z);
  ac.heading = strip.heading * Math.PI / 180;
  ac.pitch = 0;
  ac.roll = 0;
  ac.speed = 0;
  ac.throttle = 0;
  ac.flight = FLIGHT.PARKED;
  ac.onGround = true;
  ac.lastStrip = strip;
  ac.parkedTimer = 0;
}

/**
 * Step the flight model one frame. `input` is { throttle, pitch, roll, yaw }
 * in -1..1 (throttle is a delta: +1 raises, -1 lowers). Returns events:
 * 'takeoff' | 'landed' | 'hard-landing' | 'terrain-strike' | 'ditched' |
 * 'fuel-empty' | 'crashed', or null.
 */
export function stepFlight(ac, input, dt) {
  if (ac.flight === FLIGHT.CRASHED) return null;
  const cfg = AIRCRAFT;

  // Throttle: W/S nudge it; it stays where you leave it.
  ac.throttle = THREE.MathUtils.clamp(ac.throttle + input.throttle * dt * 0.7, 0, 1);

  // Fuel: the engine drinks with throttle; empty tanks mean a glider.
  const burn = (cfg.fuelBurnIdle + (cfg.fuelBurnPerSec - cfg.fuelBurnIdle) * ac.throttle) * dt;
  const hadFuel = ac.fuel > 0;
  ac.fuel = Math.max(0, ac.fuel - burn);
  if (hadFuel && ac.fuel === 0) return 'fuel-empty';
  const engineOut = ac.fuel <= 0;

  // Stick: pitch and roll chase their targets; the nose answers at every speed.
  const targetPitch = input.pitch * (cfg.maxPitchDeg * Math.PI / 180);
  const targetRoll = input.roll * (cfg.maxBankDeg * Math.PI / 180);
  const pitchRate = cfg.pitchSpeedDeg * Math.PI / 180;
  const rollRate = cfg.rollSpeedDeg * Math.PI / 180;
  ac.pitch += THREE.MathUtils.clamp(targetPitch - ac.pitch, -pitchRate * dt, pitchRate * dt);
  ac.roll += THREE.MathUtils.clamp(targetRoll - ac.roll, -rollRate * dt, rollRate * dt);

  // Turn: bank turns the nose; the rudder (Q/E) adds a little direct yaw.
  const turnRate = (9.81 * Math.tan(ac.roll)) / Math.max(ac.speed, 8) * cfg.turnAuthority;
  ac.heading += (turnRate + input.yaw * (cfg.yawSpeedDeg * Math.PI / 180) * 0.4) * dt;

  // Speed chases the throttle's target; drag grows with the square of speed.
  const targetSpeed = engineOut ? 0 : ac.throttle * cfg.maxSpeed;
  const drag = 0.02 * ac.speed * ac.speed * 0.02;
  ac.speed += THREE.MathUtils.clamp(targetSpeed - ac.speed, -cfg.accel * dt - drag * dt, cfg.accel * dt);

  // Lift: above stall speed the wing flies; below it she sinks.
  const liftFactor = THREE.MathUtils.clamp((ac.speed - cfg.stallSpeed) / 18, -1.2, 1);
  const climb = Math.sin(ac.pitch) * ac.speed * (liftFactor > 0 ? 1 : 0.35);
  const sink = liftFactor < 0 ? (cfg.stallSpeed - ac.speed) * 0.35 : 0;
  ac.verticalSpeed = climb - sink;

  // Move. Heading is a true compass heading: 0 = north (-z), 90 = east (+x).
  const forward = new THREE.Vector3(Math.sin(ac.heading), 0, -Math.cos(ac.heading));
  ac.pos.addScaledVector(forward, ac.speed * Math.cos(ac.pitch) * dt);
  ac.pos.y += ac.verticalSpeed * dt;

  // Stay inside the world.
  const half = 2900;
  ac.pos.x = THREE.MathUtils.clamp(ac.pos.x, -half, half);
  ac.pos.z = THREE.MathUtils.clamp(ac.pos.z, -half, half);
  if (ac.pos.y > 900) { ac.pos.y = 900; ac.pitch = Math.min(ac.pitch, 0); }

  // Takeoff: rolling fast enough with the nose up lifts off the strip.
  if (ac.onGround) {
    if (ac.speed > cfg.stallSpeed + 2 && ac.pitch > 0.06) {
      ac.onGround = false;
      ac.flight = FLIGHT.FLYING;
      return 'takeoff';
    }
    // Rolling on the ground: stay glued to the terrain.
    const gh = groundHeight(ac.pos.x, ac.pos.z);
    ac.pos.y = gh + cfg.gearHeight;
    ac.verticalSpeed = 0;
    ac.pitch *= 0.9;
    ac.roll *= 0.9;
  } else {
    ac.flight = FLIGHT.FLYING;
  }

  // Ground / sea contact while airborne (the on-ground roll is handled above;
  // without this guard a parked plane would "land" every single frame).
  if (!ac.onGround) {
  const gh = groundHeight(ac.pos.x, ac.pos.z);
  const clearance = ac.pos.y - gh;
  if ((clearance < cfg.gearHeight - 0.05 || (clearance <= cfg.gearHeight && ac.verticalSpeed < -1.0)) && ac.verticalSpeed <= 0.5) {
    const strip = stripAt(ac.pos.x, ac.pos.z);
    const overSea = gh < 0.5;
    if (overSea) {
      // Ditching: she floats down, takes damage, and is towed to the nearest strip.
      ac.damage = Math.min(100, ac.damage + cfg.ditchDamage);
      ac.pos.y = cfg.gearHeight + 0.4;
      ac.speed = 0;
      ac.onGround = true;
      ac.flight = FLIGHT.PARKED;
      let best = AIRSTRIPS[0], bd = Infinity;
      for (const s of AIRSTRIPS) {
        const d = Math.hypot(s.x - ac.pos.x, s.z - ac.pos.z);
        if (d < bd) { bd = d; best = s; }
      }
      placeOnStrip(ac, best);
      if (ac.damage >= 100) { ac.flight = FLIGHT.CRASHED; return 'crashed'; }
      return 'ditched';
    }
    if (strip && Math.abs(ac.verticalSpeed) <= cfg.safeLandingVs && ac.speed <= cfg.safeLandingSpeed + 6) {
      // A landing: roll out on the strip, fuel and repairs happen while parked.
      ac.pos.y = strip.strip.elev + cfg.gearHeight;
      ac.onGround = true;
      ac.flight = FLIGHT.PARKED;
      ac.lastStrip = strip.strip;
      ac.pitch = 0;
      ac.roll = 0;
      ac.speed *= 0.4;
      return 'landed';
    }
    if (Math.abs(ac.verticalSpeed) <= cfg.safeLandingVs && ac.speed <= cfg.safeLandingSpeed) {
      // A survivable off-strip touchdown on a beach or flat field.
      ac.pos.y = gh + cfg.gearHeight;
      ac.onGround = true;
      ac.flight = FLIGHT.PARKED;
      ac.pitch = 0;
      ac.roll = 0;
      ac.speed *= 0.3;
      return 'landed';
    }
    // Terrain strike: damage scales with how hard she hit.
    const hit = Math.abs(ac.verticalSpeed) + ac.speed * 0.15;
    ac.damage = Math.min(100, ac.damage + cfg.terrainStrikeDamage * Math.min(1, hit / 14));
    ac.pos.y = gh + cfg.gearHeight;
    ac.speed = 0;
    ac.onGround = true;
    ac.flight = FLIGHT.PARKED;
    ac.pitch = 0;
    ac.roll = 0;
    if (ac.damage >= 100) { ac.flight = FLIGHT.CRASHED; return 'crashed'; }
    return 'terrain-strike';
  }
  } // end airborne ground-contact check

  // Hard landing check is folded into the contact above; a rough-but-ok
  // touchdown on a strip still rattles the airframe a little.
  return null;
}

/** While parked at a strip: refuel, repair, bleed speed. Returns events. */
export function stepParked(ac, dt) {
  const events = [];
  if (!ac.onGround) return events;
  ac.parkedTimer += dt;
  ac.speed = Math.max(0, ac.speed - 14 * dt);
  const strip = stripAt(ac.pos.x, ac.pos.z);
  if (strip) {
    if (ac.fuel < AIRCRAFT.fuelCapacity) ac.fuel = Math.min(AIRCRAFT.fuelCapacity, ac.fuel + AIRCRAFT.refuelRate * dt);
    if (ac.damage > 0) ac.damage = Math.max(0, ac.damage - AIRCRAFT.repairRate * dt);
    if (ac.fuel >= AIRCRAFT.fuelCapacity && ac.damage <= 0 && ac.parkedTimer > 1) events.push('serviced');
  }
  return events;
}

/** Apply the flight state to the visible mesh. */
export function posePlane(mesh, prop, ac, t) {
  mesh.group.position.copy(ac.pos);
  // Model faces -z; rotate so heading 0 points north (-z).
  mesh.group.rotation.set(0, 0, 0);
  mesh.group.rotateY(ac.heading);
  mesh.group.rotateX(-ac.pitch);
  mesh.group.rotateZ(ac.roll);
  // Engine vibration and prop spin scale with throttle.
  const spin = (2 + ac.throttle * 38) * (ac.fuel > 0 ? 1 : 0.05);
  prop.rotation.z += spin * 0.016;
  mesh.group.position.y += Math.sin(t * 31) * 0.02 * ac.throttle;
}
