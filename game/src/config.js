// Nusantara Sky Courier — every tuning number and colour in one place.
// Units are metres, metres-per-second and degrees. The world is a tropical
// Indonesian archipelago about 6 km across, ringed by turquoise sea.

export const WORLD = {
  size: 6000, // playable square, centred on (0, 0)
  seaLevel: 0,
  gravity: 9.81,
  maxAltitude: 900,
};

// Islands: centre, radius, peak height, volcano flag. Beaches form where an
// island meets the sea; airstrips sit on the three largest islands.
export const ISLANDS = [
  { name: 'Pulau Merdeka', x: -950, z: -650, radius: 720, peak: 130, volcano: false },
  { name: 'Pulau Api', x: 950, z: -750, radius: 620, peak: 280, volcano: true },
  { name: 'Pulau Karang', x: 850, z: 950, radius: 560, peak: 46, volcano: false },
  { name: 'Pulau Hijau', x: -850, z: 850, radius: 520, peak: 95, volcano: false },
  { name: 'Pulau Kecil', x: 80, z: 120, radius: 260, peak: 34, volcano: false },
  { name: 'Pulau Batu', x: -150, z: -1450, radius: 300, peak: 70, volcano: false },
  { name: 'Pulau Pasir', x: 1450, z: 80, radius: 240, peak: 18, volcano: false },
];

// Airstrips: position, runway heading (deg, 0 = north, 90 = east), length, width, elevation.
// All three sit on low coastal flats so the approach is over the sea, not a cliff.
export const AIRSTRIPS = [
  { name: 'Merdeka Field', island: 'Pulau Merdeka', x: -400, z: -650, heading: 90, length: 300, width: 26, elev: 8 },
  { name: 'Api Strip', island: 'Pulau Api', x: 950, z: -160, heading: 0, length: 260, width: 24, elev: 6 },
  { name: 'Karang Field', island: 'Pulau Karang', x: 850, z: 1380, heading: 135, length: 280, width: 26, elev: 5 },
];

// Golden rings for the ring course: a scenic loop over the water around the
// islands — every ring sits at least 45 m above the ground or sea below it.
export const RING_COURSE = [
  { x: -450, z: -1050, y: 70 },
  { x: 0, z: -1150, y: 80 },
  { x: 600, z: -1150, y: 85 },
  { x: 1150, z: -350, y: 110 },
  { x: 1300, z: 300, y: 75 },
  { x: 1100, z: 700, y: 75 },
  { x: 500, z: 1150, y: 80 },
  { x: -100, z: 1200, y: 75 },
];

export const AIRCRAFT = {
  maxSpeed: 58, // m/s at full throttle
  cruiseSpeed: 38,
  stallSpeed: 15, // below this the wings stop flying and she sinks
  accel: 9, // m/s^2 toward the throttle's target speed
  climbRate: 1.0,
  maxPitchDeg: 28,
  maxBankDeg: 48,
  turnAuthority: 1.0,
  pitchSpeedDeg: 55, // how fast the nose answers the stick, deg/s
  rollSpeedDeg: 110,
  yawSpeedDeg: 22,
  fuelCapacity: 100,
  fuelBurnPerSec: 0.55, // at full throttle; less at idle
  fuelBurnIdle: 0.12,
  gearHeight: 1.4, // height of the floats above the ground when parked
  safeLandingVs: 4.5, // vertical speed (m/s) a landing can absorb
  safeLandingSpeed: 30,
  hardLandingDamage: 22,
  terrainStrikeDamage: 45,
  ditchDamage: 35,
  repairRate: 25, // damage repaired per second while parked at a strip
  refuelRate: 30, // fuel per second while parked at a strip
};

export const MISSIONS = {
  rings: { id: 'rings', name: 'Ring Run', blurb: 'Fly the golden ring course over the islands. 8 rings, no clock — clean flying wins.' },
  delivery: { id: 'delivery', name: 'Island Deliveries', blurb: 'Carry cargo to all three island airstrips. Land, unload, take off again. Watch your fuel.' },
  timed: { id: 'timed', name: 'Timed Courier', blurb: '180 seconds. Rings appear around the archipelago — fly as many as you can before the clock dies.' },
};

export const SCORING = {
  ringPoints: 100,
  ringTimeBonusPerSec: 2, // timed mission only, leftover seconds are worth points
  deliveryPoints: 250,
  landingBonus: 50, // gentle touchdown
  perfectRingBonus: 25, // through the centre of the ring
};

export const TIMED_LIMIT = 180;

export const PALETTE = {
  skyTop: 0x2f7fd0,
  skyHorizon: 0xbfe6f2,
  sun: 0xfff2c0,
  seaDeep: 0x0b5e7a,
  seaShallow: 0x2ec4b6,
  sand: 0xf2ddab,
  grass: 0x4da34a,
  jungle: 0x2c7a3a,
  volcanoRock: 0x5a4a42,
  lava: 0xff5a1f,
  runway: 0x3a3f46,
  runwayMark: 0xf5f5f5,
  ring: 0xffc21c,
  ringGlow: 0xffdf6b,
  planeWhite: 0xf8f4e8,
  planeTeal: 0x0e7c7b,
  planeOrange: 0xff7a1a,
  cloud: 0xffffff,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const BEST_KEY = 'nusantara-sky-courier.best';
