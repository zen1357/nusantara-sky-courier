// sky.js — the tropical sky: gradient dome, sun, drifting clouds, lighting.
// The sky, sea and terrain share one warm palette so the scene reads as one place.
import * as THREE from '../vendor/three.module.min.js';
import { PALETTE, WORLD } from './config.js';

export function buildSky(scene, renderer) {
  // Gradient dome: a big inverted sphere shaded top-to-horizon by a shader.
  const skyGeo = new THREE.SphereGeometry(WORLD.size * 1.4, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
      void main() {
        float t = clamp(normalize(vPos).y * 1.6 + 0.12, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, top, pow(t, 0.8)), 1.0);
      }`,
  });
  const dome = new THREE.Mesh(skyGeo, skyMat);
  dome.name = 'skyDome';
  scene.add(dome);

  // Sun: a bright disc + glow sprite, low in the west for long warm light.
  const sunDir = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.copy(sunDir).multiplyScalar(WORLD.size * 1.25);
  sun.lookAt(0, 0, 0);
  sun.name = 'sunDisc';
  scene.add(sun);

  // Lighting: warm sun + cool sky fill, tuned so the plane stays readable.
  const sunLight = new THREE.DirectionalLight(0xfff1cf, 2.4);
  sunLight.position.copy(sunDir).multiplyScalar(3000);
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(0xbfe3f2, 0x2e6b4f, 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xcfe9f2, 1800, 6500);
  renderer.setClearColor(0x9fd4e8);

  // Clouds: clusters of flattened white spheres, drifting slowly.
  const cloudGroup = new THREE.Group();
  cloudGroup.name = 'clouds';
  // Unlit white: clouds seen from below stay bright puffs, never grey slabs.
  const cloudMat = new THREE.MeshBasicMaterial({ color: PALETTE.cloud, transparent: true, opacity: 0.92 });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  const clouds = [];
  let seed = 12345;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      const s = 14 + rand() * 22;
      puff.scale.set(s, s * 0.42, s * 0.8);
      puff.position.set((rand() - 0.5) * 70, (rand() - 0.5) * 8, (rand() - 0.5) * 30);
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * WORLD.size * 1.6, 260 + rand() * 260, (rand() - 0.5) * WORLD.size * 1.6);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);

  return {
    sunDir,
    update(dt, t) {
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > WORLD.size) cloud.position.x = -WORLD.size;
      }
      // Gentle sun shimmer on the lava light is handled in terrain; nothing else moves.
    },
  };
}
