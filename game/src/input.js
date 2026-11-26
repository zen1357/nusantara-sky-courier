// input.js — keyboard + mouse. Arrow keys fly the stick, W/S work the
// throttle, Q/E the rudder, Space brakes on the ground. Dragging the mouse
// orbits the chase camera; the wheel zooms it in and out.
export function createInput() {
  return {
    keys: new Set(),
    // Stick state, -1..1, smoothed by the flight model.
    pitch: 0, // + = nose up (ArrowUp / W is throttle, so pitch is arrows only)
    roll: 0,
    yaw: 0,
    throttleDelta: 0,
    // Camera orbit: mouse drag adds an offset that eases back to centre.
    camYaw: 0,
    camPitch: 0,
    camDist: 26,
    dragging: false,
    lastX: 0,
    lastY: 0,
    anyKey: false,
  };
}

const KEYMAP = {
  ArrowUp: 'pitchUp',
  ArrowDown: 'pitchDown',
  ArrowLeft: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyW: 'throttleUp',
  KeyS: 'throttleDown',
  KeyQ: 'yawLeft',
  KeyE: 'yawRight',
  Space: 'brake',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
  Enter: 'confirm',
  Escape: 'pause',
};

export function attachInput(input, canvas, callbacks) {
  const down = (e) => {
    if (e.code === 'Space') e.preventDefault();
    const action = KEYMAP[e.code];
    if (!action) return;
    input.keys.add(action);
    input.anyKey = true;
    if (callbacks.onAction) callbacks.onAction(action, true);
  };
  const up = (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    input.keys.delete(action);
    if (callbacks.onAction) callbacks.onAction(action, false);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    input.dragging = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { input.dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.camYaw -= (e.clientX - input.lastX) * 0.004;
    input.camPitch = Math.max(-0.5, Math.min(0.6, input.camPitch + (e.clientY - input.lastY) * 0.003));
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.camDist = Math.max(14, Math.min(60, input.camDist + e.deltaY * 0.02));
  }, { passive: false });

  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}

/** Read the current stick position from the held keys. */
export function readStick(input) {
  const k = input.keys;
  input.pitch = (k.has('pitchUp') ? 1 : 0) - (k.has('pitchDown') ? 1 : 0);
  input.roll = (k.has('rollRight') ? 1 : 0) - (k.has('rollLeft') ? 1 : 0);
  input.yaw = (k.has('yawRight') ? 1 : 0) - (k.has('yawLeft') ? 1 : 0);
  input.throttleDelta = (k.has('throttleUp') ? 1 : 0) - (k.has('throttleDown') ? 1 : 0);
  return {
    pitch: input.pitch,
    roll: input.roll,
    yaw: input.yaw,
    throttle: input.throttleDelta,
    brake: k.has('brake'),
  };
}

/** Ease the camera orbit offset back toward straight-behind. */
export function decayCamera(input, dt) {
  input.camYaw *= Math.pow(0.25, dt);
  input.camPitch *= Math.pow(0.25, dt);
}
