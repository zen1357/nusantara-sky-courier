// terrain.js — the archipelago: islands, sea, beaches, volcano, airstrips,
// golden rings. One height function drives both the visible mesh and the
// flight model's ground collisions, so what you see is what you can hit.
import * as THREE from '../vendor/three.module.min.js';
import { ISLANDS, AIRSTRIPS, RING_COURSE, PALETTE, WORLD } from './config.js';

// Deterministic wobble so every island has its own coastline and ridges.
function hash2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

function islandProfile(t) {
  // t = 0 at the centre, 1 at the shore. Gentle dome with a flat beach rim.
  if (t >= 1) return 0;
  const dome = Math.pow(Math.cos(t * Math.PI * 0.5), 1.4);
  const beach = t > 0.82 ? 0.06 + (t - 0.82) * 0.1 : 0;
  return Math.max(dome, beach);
}

/** Ground height (metres above sea level) at any x, z. Negative = sea floor. */
export function groundHeight(x, z) {
  let h = -14;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= isl.radius) continue;
    const t = d / isl.radius;
    const wobble = 1 + 0.1 * noise2(isl.x * 0.01 + dx * 0.01, isl.z * 0.01 + dz * 0.01);
    let islandH = isl.peak * islandProfile(t) * wobble;
    if (isl.volcano) {
      // A cratered cone: steep sides, a hollow summit.
      islandH = isl.peak * Math.pow(Math.max(0, 1 - t), 1.15) * wobble;
      if (t < 0.16) islandH -= (0.16 - t) * isl.peak * 2.2; // crater bowl
    }
    h = Math.max(h, islandH);
  }
  // Flatten the ground under each airstrip so the runway sits on level earth.
  for (const strip of AIRSTRIPS) {
    const dx = x - strip.x, dz = z - strip.z;
    const along = dx * Math.sin(strip.heading * Math.PI / 180) * -1 + dz * Math.cos(strip.heading * Math.PI / 180);
    const across = dx * Math.cos(strip.heading * Math.PI / 180) + dz * Math.sin(strip.heading * Math.PI / 180);
    const ad = Math.abs(along) / (strip.length / 2 + 250);
    const cd = Math.abs(across) / (strip.width / 2 + 200);
    const m = Math.max(0, 1 - Math.max(ad, cd));
    const blend = m * m * (3 - 2 * m);
    h = h + (strip.elev - h) * blend;
  }
  return h;
}

/** Which island (if any) is under x, z, and how far from its centre. */
export function islandAt(x, z) {
  for (const isl of ISLANDS) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d < isl.radius) return { island: isl, t: d / isl.radius };
  }
  return null;
}

/** True when x, z is on a runway rectangle (with a small margin). */
export function stripAt(x, z) {
  for (const strip of AIRSTRIPS) {
    const rad = strip.heading * Math.PI / 180;
    const dx = x - strip.x, dz = z - strip.z;
    const along = -dx * Math.sin(rad) + dz * Math.cos(rad);
    const across = dx * Math.cos(rad) + dz * Math.sin(rad);
    if (Math.abs(along) <= strip.length / 2 + 8 && Math.abs(across) <= strip.width / 2 + 8) {
      return { strip, along, across };
    }
  }
  return null;
}

function colourForHeight(h, x, z) {
  const c = new THREE.Color();
  if (h < 0.5) { c.setHex(PALETTE.sand); return c; } // beach
  if (h < 6) { c.setHex(PALETTE.sand).lerp(new THREE.Color(PALETTE.grass), (h - 0.5) / 5.5); return c; }
  if (h < 60) {
    const t = (h - 6) / 54;
    c.setHex(PALETTE.grass).lerp(new THREE.Color(PALETTE.jungle), t);
    // jungle mottling
    const n = noise2(x * 0.05, z * 0.05);
    c.offsetHSL(0, 0, n * 0.02);
    return c;
  }
  if (h < 150) { c.setHex(PALETTE.jungle).lerp(new THREE.Color(0x6b7a5a), (h - 60) / 90); return c; }
  c.setHex(PALETTE.volcanoRock);
  return c;
}

export function buildTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'terrain';

  // --- Island ground: one displaced plane, vertex-coloured by height. ---
  const SEG = 220;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const c = colourForHeight(h, x, z);
    colours[i * 3] = c.r; colours[i * 3 + 1] = c.g; colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.name = 'islandGround';
  group.add(ground);

  // --- Sea: a big translucent plane just above the sea floor. ---
  const seaGeo = new THREE.PlaneGeometry(WORLD.size * 1.6, WORLD.size * 1.6, 1, 1);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshPhongMaterial({
    color: PALETTE.seaDeep, transparent: true, opacity: 0.86,
    shininess: 120, specular: 0x99ddff,
  }));
  sea.position.y = 0.4;
  sea.name = 'sea';
  group.add(sea);

  // Shallow turquoise lagoon rings around each island.
  for (const isl of ISLANDS) {
    const lagoon = new THREE.Mesh(
      new THREE.CircleGeometry(isl.radius * 1.12, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.seaShallow, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    lagoon.rotation.x = -Math.PI / 2;
    lagoon.position.set(isl.x, 0.7, isl.z);
    group.add(lagoon);
  }

  // --- Volcano crater glow on Pulau Api. ---
  const api = ISLANDS.find((i) => i.volcano);
  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.lava }),
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(api.x, groundHeight(api.x, api.z) + 2, api.z);
  lava.name = 'lava';
  group.add(lava);
  const lavaLight = new THREE.PointLight(0xff6a2a, 60, 500, 1.6);
  lavaLight.position.set(api.x, groundHeight(api.x, api.z) + 30, api.z);
  group.add(lavaLight);

  // --- Airstrips: asphalt slab, centreline dashes, threshold bars, windsock. ---
  for (const strip of AIRSTRIPS) {
    const g = new THREE.Group();
    g.position.set(strip.x, strip.elev + 0.35, strip.z);
    g.rotation.y = strip.heading * Math.PI / 180;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(strip.width, 0.7, strip.length),
      new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
    );
    g.add(slab);
    const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayMark });
    for (let d = -strip.length / 2 + 24; d < strip.length / 2 - 12; d += 24) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 12), dashMat);
      dash.position.set(0, 0.45, d);
      g.add(dash);
    }
    for (const end of [-1, 1]) {
      for (let k = -2; k <= 2; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 7), dashMat);
        bar.position.set(k * 4.4, 0.45, end * (strip.length / 2 - 10));
        g.add(bar);
      }
    }
    // Windsocks at both ends.
    for (const end of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 6), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
      pole.position.set(strip.width / 2 + 6, 3.5, end * (strip.length / 2 - 8));
      g.add(pole);
      const sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 8), new THREE.MeshLambertMaterial({ color: 0xff7a1a }));
      sock.rotation.z = Math.PI / 2;
      sock.position.set(strip.width / 2 + 9, 6.4, end * (strip.length / 2 - 8));
      g.add(sock);
    }
    // A small hangar + hut beside the strip so it reads as an airfield.
    const hut = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }));
    hut.position.set(-strip.width / 2 - 18, 3, -strip.length / 2 + 30);
    g.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 4, 4), new THREE.MeshLambertMaterial({ color: 0xb3541e }));
    roof.position.set(-strip.width / 2 - 18, 8, -strip.length / 2 + 30);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    group.add(g);
  }

  // --- Golden rings (built by missions.js logic, meshes here). ---
  // Each ring faces the direction the course arrives from (the previous
  // ring, or Merdeka Field for ring 1), so the hole reads as a circle from
  // the chase camera on the approach — a north-facing ring flown at from
  // the west is edge-on and nearly invisible as a target.
  const ringGroup = new THREE.Group();
  ringGroup.name = 'rings';
  for (let i = 0; i < RING_COURSE.length; i++) {
    const p = RING_COURSE[i];
    const prev = i === 0 ? AIRSTRIPS[0] : RING_COURSE[i - 1];
    const dx = p.x - prev.x, dz = p.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(16, 1.6, 12, 40),
      new THREE.MeshStandardMaterial({ color: PALETTE.ring, emissive: PALETTE.ringGlow, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.3 }),
    );
    ring.position.set(p.x, p.y, p.z);
    // Torus axis is +z; rotate it onto the approach direction.
    ring.rotation.y = Math.atan2(dx / len, dz / len);
    ring.name = `ring-${i}`;
    ringGroup.add(ring);
    // A slim pole down to the water so the ring reads at distance.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, p.y, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }),
    );
    pole.position.set(p.x, p.y / 2, p.z);
    ringGroup.add(pole);
  }
  group.add(ringGroup);

  scene.add(group);
  return { group, ringGroup };
}
