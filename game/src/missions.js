// missions.js — the three jobs: fly the golden ring course, deliver cargo to
// the three island airstrips, or beat a 180-second clock. Scoring, win/fail
// and the objective line live here; the flight model lives in aircraft.js.
import * as THREE from '../vendor/three.module.min.js';
import { RING_COURSE, AIRSTRIPS, SCORING, TIMED_LIMIT, MISSIONS } from './config.js';
import { stripAt } from './terrain.js';

export function createMission(missionId) {
  const m = {
    id: missionId,
    name: MISSIONS[missionId].name,
    timeLimit: missionId === 'timed' ? TIMED_LIMIT : 0,
    elapsed: 0,
    score: 0,
    ringsPassed: 0,
    ringsTotal: missionId === 'timed' ? Infinity : RING_COURSE.length,
    ringIndex: 0,
    deliveriesDone: 0,
    deliveryOrder: [AIRSTRIPS[1], AIRSTRIPS[2], AIRSTRIPS[0]], // Api, Karang, home
    deliveredAt: new Set(),
    won: false,
    over: false,
    endReason: '',
    // Perfect-ring tracking: the pass registers the moment the plane enters
    // the 16 m sphere, so the bonus is judged on the closest approach while
    // flying through it (see stepMission), not on the entry distance.
    pendingPerfect: null,
    // Timed mode: rings appear one at a time at scattered spots.
    timedRing: null,
    timedRingIndex: 0,
    best: 0,
  };
  if (missionId === 'timed') m.timedRing = nextTimedRing(m);
  return m;
}

function nextTimedRing(m) {
  // Deterministic-ish scatter: seeded by how many rings have been flown.
  let seed = 7919 + m.timedRingIndex * 104729;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const spots = [
    { x: -450, z: -1050, y: 70 }, { x: 0, z: -1150, y: 80 }, { x: 600, z: -1150, y: 85 },
    { x: 1150, z: -350, y: 110 }, { x: 1300, z: 300, y: 75 }, { x: 1100, z: 700, y: 75 },
    { x: 500, z: 1150, y: 80 }, { x: -100, z: 1200, y: 75 },
    { x: 1500, z: -1800, y: 70 }, { x: 0, z: -2000, y: 80 },
    { x: -1100, z: 0, y: 60 }, { x: -700, z: 1100, y: 95 },
  ];
  const pick = spots[Math.floor(rand() * spots.length)];
  return { ...pick, index: m.timedRingIndex };
}

/** The ring the pilot should aim at now (null when the course is done). */
export function currentRing(m) {
  if (m.id === 'timed') return m.timedRing;
  if (m.ringIndex >= RING_COURSE.length) return null;
  return { ...RING_COURSE[m.ringIndex], index: m.ringIndex };
}

/** The airstrip a delivery is owed to now (null when all delivered). */
export function currentDeliveryStrip(m) {
  if (m.id !== 'delivery') return null;
  if (m.deliveriesDone >= m.deliveryOrder.length) return null;
  return m.deliveryOrder[m.deliveriesDone];
}

/**
 * Step mission logic one frame. `events` carries flight events from
 * aircraft.js ('landed', 'crashed', ...). Returns fresh events for main.js:
 * 'ring' | 'delivery' | 'win' | 'fail' | 'time-up'.
 */
export function stepMission(m, ac, dt, events) {
  const out = [];
  if (m.over) return out;
  m.elapsed += dt;

  // Timed mode: the clock is the boss.
  if (m.timeLimit && m.elapsed >= m.timeLimit) {
    m.over = true;
    m.won = m.score > 0;
    m.endReason = 'time-up';
    out.push('time-up');
    return out;
  }

  // Ring pass: within the torus, close to its plane, flying roughly through it.
  // A pending perfect bonus resolves when the plane leaves the sphere the
  // pass was scored in: the bonus is for the closest approach while flying
  // through, and the pass itself registers on entry (~16 m out), so judging
  // it on the entry distance would make it unreachable. (The final ring of
  // a won course never resolves its pending bonus — the win takes precedence.)
  if (m.pendingPerfect) {
    const p = m.pendingPerfect;
    const pd = Math.hypot(ac.pos.x - p.x, ac.pos.y - p.y, ac.pos.z - p.z);
    p.closest = Math.min(p.closest, pd);
    if (pd > 16) {
      if (p.closest < 7) {
        m.score += SCORING.perfectRingBonus;
        out.push('perfect');
      }
      m.pendingPerfect = null;
    }
  }
  const ring = currentRing(m);
  if (ring) {
    const d = Math.hypot(ac.pos.x - ring.x, ac.pos.y - ring.y, ac.pos.z - ring.z);
    if (d < 16) {
      m.score += SCORING.ringPoints;
      m.ringsPassed += 1;
      m.pendingPerfect = { x: ring.x, y: ring.y, z: ring.z, closest: d };
      out.push('ring');
      if (m.id === 'timed') {
        m.timedRingIndex += 1;
        m.timedRing = nextTimedRing(m);
      } else {
        m.ringIndex += 1;
        if (m.ringIndex >= RING_COURSE.length) {
          m.over = true;
          m.won = true;
          m.endReason = 'rings-complete';
          out.push('win');
        }
      }
    }
  }

  // Deliveries: land on the strip the cargo is owed to.
  if (events.includes('landed') && m.id === 'delivery') {
    const target = currentDeliveryStrip(m);
    const here = stripAt(ac.pos.x, ac.pos.z);
    if (target && here && here.strip.name === target.name && !m.deliveredAt.has(target.name)) {
      m.deliveredAt.add(target.name);
      m.deliveriesDone += 1;
      m.score += SCORING.deliveryPoints + SCORING.landingBonus;
      out.push('delivery');
      if (m.deliveriesDone >= m.deliveryOrder.length) {
        m.over = true;
        m.won = true;
        m.endReason = 'deliveries-complete';
        out.push('win');
      }
    }
  }

  // A gentle touchdown ON AN AIRSTRIP pays a small bonus (once per landing).
  // Touching down on a beach or a field does not — the bonus is for flying
  // the plane to a strip, and gating it stops beach-bounce score farming
  // (repeated gentle off-strip touchdowns each paid +50 before this).
  if (events.includes('landed') && m.id !== 'delivery' && stripAt(ac.pos.x, ac.pos.z)) {
    m.score += SCORING.landingBonus;
  }

  if (events.includes('crashed')) {
    m.over = true;
    m.won = false;
    m.endReason = 'crashed';
    out.push('fail');
  }
  return out;
}

/** The objective line for the HUD, with the next target highlighted. */
export function objectiveHtml(m) {
  if (m.id === 'rings') {
    const ring = currentRing(m);
    if (!ring) return 'Course complete — nice flying! 🏆';
    return `RING <span class="next">${m.ringIndex + 1} / ${RING_COURSE.length}</span> — fly through the golden ring`;
  }
  if (m.id === 'delivery') {
    const strip = currentDeliveryStrip(m);
    if (!strip) return 'All cargo delivered — nice flying! 🏆';
    return `DELIVER TO <span class="next">${strip.name.toUpperCase()}</span> — ${m.deliveriesDone} / 3 done`;
  }
  const ring = currentRing(m);
  return `TIMED RUN — rings flown <span class="next">${m.ringsPassed}</span> · next ring ahead`;
}

/** Human-readable results text for the results screen. */
export function resultsText(m) {
  if (m.endReason === 'rings-complete') {
    return `All ${RING_COURSE.length} golden rings flown in ${fmtTime(m.elapsed)}. The archipelago is yours.`;
  }
  if (m.endReason === 'deliveries-complete') {
    return `Cargo delivered to all three island airstrips in ${fmtTime(m.elapsed)}. The islands eat tonight.`;
  }
  if (m.endReason === 'time-up') {
    return `The clock ran out with ${m.ringsPassed} rings flown. ${m.ringsPassed >= 5 ? 'A fine courier run.' : 'The rings will wait for a rematch.'}`;
  }
  if (m.endReason === 'crashed') return 'The airframe gave up. The islands are patient — the courier can fly again.';
  return 'Flight over.';
}

export function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Point the next ring's mesh at the pilot: dim passed rings, light the next. */
export function updateRingMeshes(ringGroup, m) {
  if (!ringGroup) return;
  ringGroup.children.forEach((child) => {
    if (!child.name.startsWith('ring-')) return;
    const i = Number(child.name.split('-')[1]);
    const mat = child.material;
    if (m.id === 'timed') {
      // Timed mode: only the live ring shows; hide the rest.
      const live = m.timedRing && (i === (m.timedRingIndex % RING_COURSE.length));
      child.visible = !!live;
      if (live && m.timedRing) child.position.set(m.timedRing.x, m.timedRing.y, m.timedRing.z);
      return;
    }
    child.visible = true;
    if (i < m.ringIndex) {
      mat.emissiveIntensity = 0.08;
      mat.color.setHex(0x8a8a8a);
    } else if (i === m.ringIndex) {
      mat.emissiveIntensity = 1.4;
      mat.color.setHex(0xffc21c);
      const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.08;
      child.scale.setScalar(pulse);
    } else {
      mat.emissiveIntensity = 0.5;
      mat.color.setHex(0xffc21c);
      child.scale.setScalar(1);
    }
  });
}
