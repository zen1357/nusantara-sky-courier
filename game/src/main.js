// main.js — boot + game loop for Nusantara Sky Courier.
// Wires the flight model, terrain, sky, HUD, missions, input and audio
// together; owns the chase camera, the screens, and the ?shot= staging hook.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, BEST_KEY, MISSIONS, SCORING } from './config.js';
import { buildTerrain } from './terrain.js';
import { buildSky } from './sky.js';
import { buildPlaneMesh, createAircraft, stepFlight, stepParked, posePlane, placeOnStrip, FLIGHT } from './aircraft.js';
import { createMission, stepMission, currentRing, currentDeliveryStrip, objectiveHtml, resultsText, updateRingMeshes } from './missions.js';
import { createInput, attachInput, readStick, decayCamera } from './input.js';
import { createAudio, startAudio, updateAudio, playChime, playThud, playWarning, playCrash, playSuccess, toggleMute } from './audio.js';
import { buildHud, updateHud, showMessage, showScreen } from './hud.js';
import { stageShot } from './shots.js';
import { AIRSTRIPS } from './config.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 12000);

const sky = buildSky(scene, renderer);
const { ringGroup } = buildTerrain(scene);
const plane = buildPlaneMesh();
scene.add(plane.group);

const ui = buildHud();
const input = createInput();
const audio = createAudio();

const game = {
  screen: 'title',
  aircraft: createAircraft(),
  mission: createMission('rings'),
  selectedMission: 'rings',
  best: Number(localStorage.getItem(BEST_KEY) ?? 0) || 0,
  elapsed: 0,
  paused: false,
  muted: false,
  camPos: new THREE.Vector3(),
  camTarget: new THREE.Vector3(),
  time: 0,
  shotStaged: false,
};
window.__game = game; // play-test hook: read state, drive input, stage shots.
window.__stageShot = (name) => stageShot(name, game);

attachInput(input, canvas, {
  onAction(action, pressed) {
    if (!pressed) return;
    startAudio(audio);
    if (action === 'pause') togglePause();
    if (action === 'mute') { game.muted = toggleMute(audio); showMessage(ui, game.muted ? '🔇 MUTED' : '🔊 SOUND ON', 1200); }
    if (action === 'restart' && game.screen === 'results') startMission(game.selectedMission);
    if (action === 'confirm' && game.screen === 'title') startMission(game.selectedMission);
  },
});

function stateLabel() {
  const ac = game.aircraft;
  if (ac.flight === FLIGHT.CRASHED) return 'CRASHED';
  if (ac.onGround) {
    const strip = ac.lastStrip;
    return `PARKED · ${strip ? strip.name.toUpperCase() : 'FIELD'} · FUEL ${Math.round(ac.fuel)}%`;
  }
  return ac.fuel <= 0 ? 'GLIDING — NO FUEL' : 'AIRBORNE';
}

function hudState() {
  const m = game.mission;
  return {
    aircraft: game.aircraft,
    score: m.score,
    best: game.best,
    elapsed: m.elapsed,
    timeLimit: m.timeLimit,
    missionName: m.name,
    stateLabel: stateLabel(),
    objectiveHtml: objectiveHtml(m),
  };
}

function showTitle() {
  game.screen = 'title';
  game.aircraft = createAircraft();
  game.mission = createMission(game.selectedMission);
  showScreen(ui, 'title', {
    best: game.best,
    selected: game.selectedMission,
    onSelect: (id) => {
      game.selectedMission = id;
      showTitle();
    },
    onStart: () => startMission(game.selectedMission),
  });
}

function startMission(id) {
  game.selectedMission = id;
  game.aircraft = createAircraft();
  game.mission = createMission(id);
  game.screen = 'play';
  game.paused = false;
  showScreen(ui, 'none');
  showMessage(ui, `${MISSIONS[id].name.toUpperCase()} — GOOD LUCK, COURIER!`, 2600);
  startAudio(audio);
}

function togglePause() {
  if (game.screen !== 'play' && game.screen !== 'pause') return;
  game.paused = !game.paused;
  game.screen = game.paused ? 'pause' : 'play';
  if (game.paused) {
    showScreen(ui, 'pause', {
      score: game.mission.score,
      missionName: game.mission.name,
      onResume: () => togglePause(),
    });
  } else {
    showScreen(ui, 'none');
  }
}

function showResults() {
  const m = game.mission;
  game.screen = 'results';
  if (m.score > game.best) {
    game.best = m.score;
    localStorage.setItem(BEST_KEY, String(game.best));
  }
  showScreen(ui, 'results', {
    won: m.won,
    summary: resultsText(m),
    score: m.score,
    detail: m.won
      ? `Best score ${game.best.toLocaleString('en-US')} · ${m.name}`
      : `Best score ${game.best.toLocaleString('en-US')} · Rings ${m.ringsPassed} · Deliveries ${m.deliveriesDone}/3`,
    onAgain: () => startMission(game.selectedMission),
    onMenu: () => showTitle(),
  });
}

/** One fixed simulation step: flight, parked servicing, mission, events. */
game.stepSim = function stepSim(stick, dt) {
  const ac = game.aircraft;
  const m = game.mission;
  let events = [];
  if (ac.onGround && ac.speed < 2 && stick.throttle <= 0 && ac.throttle < 0.05) {
    events = events.concat(stepParked(ac, dt));
  }
  const ev = stepFlight(ac, stick, dt);
  if (ev) events.push(ev);
  const mev = stepMission(m, ac, dt, events);
  handleEvents(events.concat(mev));
  return events;
};

function handleEvents(events) {
  const ac = game.aircraft;
  const m = game.mission;
  for (const ev of events) {
    if (ev === 'takeoff') showMessage(ui, '🛫 AIRBORNE — GEAR UP, COURIER!', 2000);
    if (ev === 'landed') {
      playThud(audio);
      const strip = ac.lastStrip;
      showMessage(ui, `🛬 TOUCHDOWN — ${strip ? strip.name.toUpperCase() : 'FIELD'} · REFUELLING`, 2200);
    }
    if (ev === 'ring') {
      playChime(audio);
      showMessage(ui, `💍 RING ${m.ringsPassed}! +${m.id === 'timed' ? 100 : 100}`, 1400);
    }
    if (ev === 'perfect') {
      playChime(audio);
      showMessage(ui, `🎯 DEAD CENTRE! +${SCORING.perfectRingBonus}`, 1600);
    }
    if (ev === 'delivery') {
      playChime(audio);
      showMessage(ui, `📦 CARGO DELIVERED — ${m.deliveriesDone}/3 · +300`, 2200);
    }
    if (ev === 'ditched') {
      playCrash(audio);
      showMessage(ui, '🌊 DITCHED IN THE SEA — TOWED TO THE NEAREST STRIP', 3000);
    }
    if (ev === 'terrain-strike') {
      playCrash(audio);
      showMessage(ui, '💥 TERRAIN STRIKE — AIRFRAME DAMAGED', 2600);
    }
    if (ev === 'fuel-empty') {
      playWarning(audio);
      showMessage(ui, '⛽ FUEL EMPTY — GLIDE TO A STRIP!', 3000);
    }
    if (ev === 'crashed' || ev === 'fail' || ev === 'win' || ev === 'time-up') {
      if (ev === 'win') playSuccess(audio);
      if (ev === 'crashed' || ev === 'fail') playCrash(audio);
      showResults();
    }
  }
}

// Expose the screen actions on the game object for shots.js (and play-tests).
game.startMission = startMission;
game.showTitle = showTitle;
game.togglePause = togglePause;
const camOffset = new THREE.Vector3();
function updateCamera(dt) {
  const ac = game.aircraft;
  const dist = input.camDist;
  const height = 7 + dist * 0.28 + input.camPitch * 8;
  // Behind the plane: the negative of its forward vector, orbited by the mouse.
  const orbit = new THREE.Vector3(
    -Math.sin(ac.heading + input.camYaw),
    0,
    Math.cos(ac.heading + input.camYaw),
  );
  camOffset.copy(orbit).multiplyScalar(dist);
  camOffset.y = height;
  const want = new THREE.Vector3(ac.pos.x + camOffset.x, ac.pos.y + camOffset.y, ac.pos.z + camOffset.z);
  const k = 1 - Math.pow(0.0001, dt); // smooth follow, never snaps
  game.camPos.lerp(want, Math.min(1, k * 3));
  const look = new THREE.Vector3(
    ac.pos.x + Math.sin(ac.heading) * 12,
    ac.pos.y + 1.5,
    ac.pos.z - Math.cos(ac.heading) * 12,
  );
  game.camTarget.lerp(look, Math.min(1, k * 4));
  camera.position.copy(game.camPos);
  camera.lookAt(game.camTarget);
}

let last = performance.now();
let fpsAccum = 0, fpsCount = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // Clamp dt to [0, 0.05]: a negative step (a clock jump in a throttled or
  // headless tab) would run the sim backwards and drive the chase camera
  // away from the plane instead of toward it.
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  game.time += dt;

  if (game.screen === 'play' && !game.paused) {
    const stick = readStick(input);
    // Space brakes the rollout on the ground.
    if (stick.brake && game.aircraft.onGround) game.aircraft.speed = Math.max(0, game.aircraft.speed - 30 * dt);
    game.stepSim(stick, dt);
    decayCamera(input, dt);
    updateAudio(audio, game.aircraft.throttle, game.aircraft.speed, !game.aircraft.onGround);
  }
  sky.update(dt, game.time);
  posePlane(plane, plane.prop, game.aircraft, game.time);
  updateRingMeshes(ringGroup, game.mission);
  updateCamera(dt);
  updateHud(ui, hudState());
  renderer.render(scene, camera);

  fpsAccum += dt;
  fpsCount += 1;
  if (fpsAccum >= 2) {
    game.fps = Math.round(fpsCount / fpsAccum);
    fpsAccum = 0;
    fpsCount = 0;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boot: title screen over the parked plane at Merdeka Field.
game.camPos.set(-400 - 40, 30, -650 + 20);
game.camTarget.set(-400, 10, -650);
showTitle();
requestAnimationFrame(frame);

// Staged screenshot mode: run the autopilot, freeze on the framed shot.
if (shotName) {
  // Give the renderer a moment to compile, then stage and hold.
  setTimeout(() => {
    stageShot(shotName, game);
    game.shotStaged = true;
    if (shotName === 'title') game.screen = 'title';
    else game.screen = 'play';
    game.paused = true; // freeze the sim; the frame keeps rendering
    showScreen(ui, 'none');
    if (shotName === 'title') showTitle();
  }, 600);
}
