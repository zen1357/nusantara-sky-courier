// shots.js — staged screenshot scenes for ?shot=cover|rings|landing|title.
// Each scene plays the REAL flight model forward from a fresh state with a
// simple autopilot (steer at the next ring or runway, hold throttle, hold
// altitude), so the frame is what a short real flight looks like — the same
// scene every time, no hand-placed camera tricks.
import * as THREE from '../vendor/three.module.min.js';
import { AIRSTRIPS } from './config.js';
import { groundHeight } from './terrain.js';
import { placeOnStrip } from './aircraft.js';
import { currentRing } from './missions.js';

const STEP = 1 / 60;

/** Steer the plane at `target` (a {x,y,z}) at `alt` metres, throttle 0.75.
 * `floor` is the minimum clearance kept above the ground below — 45 m en
 * route, but only a few metres on a landing final, or the plane can never
 * come down to the runway. */
function autopilotInput(game, target, alt, floor = 45) {
  const ac = game.aircraft;
  const dx = target.x - ac.pos.x;
  const dz = target.z - ac.pos.z;
  const wantHeading = Math.atan2(dx, -dz);
  let dh = wantHeading - ac.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const roll = THREE.MathUtils.clamp(dh * 1.4, -1, 1);
  // Never fly into a hillside: hold at least `floor` above the ground below.
  const safeAlt = Math.max(alt, groundHeight(ac.pos.x, ac.pos.z) + floor);
  const altErr = safeAlt - ac.pos.y;
  const pitch = THREE.MathUtils.clamp(altErr * 0.02, -0.7, 0.7);
  return { pitch, roll, yaw: 0, throttle: 0 };
}

/**
 * Run the sim forward for `seconds` with the autopilot chasing `targetFn`
 * (a function returning the current target), then return.
 */
function flyFor(game, seconds, targetFn, alt, floor = 45) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    const target = targetFn();
    if (!target) break;
    const input = autopilotInput(game, target, alt, floor);
    // Throttle: hold 0.72 by nudging toward it.
    const ac = game.aircraft;
    const thrDelta = ac.throttle < 0.72 ? 1 : ac.throttle > 0.74 ? -1 : 0;
    game.stepSim({ ...input, throttle: thrDelta }, STEP);
    if (game.mission.over) break;
  }
}

/**
 * Stage a named scene on the live game object. Returns the screen to show.
 * The game must already be booted; this resets the mission and aircraft.
 */
export function stageShot(name, game) {
  const home = AIRSTRIPS[0];
  if (name === 'title') {
    game.showTitle();
    return 'title';
  }
  if (name === 'rings') {
    game.startMission('rings');
    placeOnStrip(game.aircraft, home);
    game.aircraft.throttle = 0.8;
    // Take off east, climb, then chase the ring course for a while.
    flyFor(game, 30, () => currentRing(game.mission) ?? { x: -450, z: -1050, y: 70 }, 75);
    return 'play';
  }
  if (name === 'landing') {
    game.startMission('delivery');
    // Park the plane on final approach to Karang Field, gear down, slow.
    // The approach starts 620 m behind the threshold, over the sea.
    const strip = AIRSTRIPS[2];
    const rad = strip.heading * Math.PI / 180;
    const fwd = new THREE.Vector3(Math.sin(rad), 0, -Math.cos(rad));
    game.aircraft.pos.set(
      strip.x - fwd.x * 620,
      strip.elev + 55,
      strip.z - fwd.z * 620,
    );
    game.aircraft.heading = rad;
    game.aircraft.speed = 26;
    game.aircraft.throttle = 0.35;
    game.aircraft.onGround = false;
    game.aircraft.flight = 'flying';
    // 14 s on final: the runway fills the frame ahead, threshold in view.
    flyFor(game, 14, () => ({ x: strip.x, y: strip.elev + 12, z: strip.z }), 30, 6);
    return 'play';
  }
  // cover: already airborne over the sea north of Merdeka, wings level,
  // flying straight at ring 1 with the island and the volcano in view —
  // the money shot: plane, ring ahead, islands, HUD lit.
  game.startMission('rings');
  const ac = game.aircraft;
  ac.pos.set(-450, 85, -1350);
  ac.heading = Math.PI; // south, straight at ring 1
  ac.pitch = 0;
  ac.roll = 0;
  ac.speed = 38;
  ac.throttle = 0.75;
  ac.onGround = false;
  ac.flight = 'flying';
  flyFor(game, 6, () => currentRing(game.mission) ?? { x: -450, z: -1050, y: 70 }, 80);
  return 'play';
}
