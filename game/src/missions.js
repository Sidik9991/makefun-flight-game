// missions.js — the six airmail sorties of the Meridian run, the golden
// rings that mark each course, and the bookkeeping that decides when a
// ring is flown, a parcel is away and a mission is done. Different goals
// per sortie: a first circuit, a harbour chain, threading the canyon,
// climbing the Anvil, a low-fuel storm run, and the dusk arrival home.

import { RUNWAY, riverCentreX } from './terrain.js';

export const RING_RADIUS = 26;

// Ring helper: a course point the pilot must pass through, facing `faceDeg`
// (the direction of travel the ring is strung across).
function ring(x, y, z, faceDeg) {
  return { x, y, z, faceDeg };
}

export const MISSIONS = [
  {
    id: 'first-light',
    name: 'First Light Run',
    brief: 'Take off north, fly the five harbour rings, and land back on the strip. The mail waits for no one, but the first run is a gentle one.',
    startMode: 'ground',
    fuel: 100,
    wind: { x: 1.2, z: 0.4 },
    finish: 'land',
    rings: [
      ring(-260, 125, -60, 0),
      ring(120, 110, -420, 20),
      ring(560, 120, -120, 80),
      ring(760, 110, 420, 150),
      ring(240, 95, 760, 190),
    ],
  },
  {
    id: 'harbour-chain',
    name: 'The Harbour Chain',
    brief: 'Seven rings strung down the east coast past Port Meridian and the harbour cranes. Mind the towers, thread the chain, land at home.',
    startMode: 'ground',
    fuel: 100,
    wind: { x: 2.0, z: -0.6 },
    finish: 'land',
    rings: [
      ring(60, 135, 60, 40),
      ring(430, 100, 210, 70),
      ring(760, 105, 330, 80),
      ring(1010, 95, 560, 110),
      ring(880, 90, 880, 170),
      ring(430, 85, 1010, 230),
      ring(-60, 90, 950, 300),
    ],
  },
  {
    id: 'thread-the-canyon',
    name: 'Thread the Canyon',
    brief: 'The river road. Six rings hang inside the Thread — walls on both sides, no room for wide turns. Follow the water north, then climb out and come home.',
    startMode: 'air',
    airStart: { x: 700, y: 150, z: 620, headingDeg: 330, speed: 52 },
    fuel: 100,
    wind: { x: 0.8, z: 1.4 },
    finish: 'land',
    rings: [
      ring(riverCentreX(240), 60, 240, 350),
      ring(riverCentreX(-160), 55, -160, 340),
      ring(riverCentreX(-560), 60, -560, 10),
      ring(riverCentreX(-960), 70, -960, 350),
      ring(riverCentreX(-1360), 120, -1360, 20),
      ring(880, 255, -1480, 90),
    ],
  },
  {
    id: 'summit-post',
    name: 'Summit Post',
    brief: 'Weather station mail for the Anvil. Five rings climb the massif to the snow line — thin air, strong legs, and a long glide home.',
    startMode: 'air',
    airStart: { x: -300, y: 320, z: -500, headingDeg: 60, speed: 58 },
    fuel: 100,
    wind: { x: -2.4, z: 1.0 },
    finish: 'land',
    rings: [
      ring(500, 240, -900, 60),
      ring(950, 330, -1250, 80),
      ring(1400, 465, -1500, 90),
      ring(1500, 330, -900, 190),
      ring(700, 210, -500, 220),
    ],
  },
  {
    id: 'storm-ledger',
    name: 'The Storm Ledger',
    brief: 'A front is coming in and the ledger must reach Lantern Isle before it lands. Half tanks, a pushing crosswind, six rings, and a water landing by the lighthouse if the strip is too far. (Any landing on the strip still counts double in our hearts.)',
    startMode: 'ground',
    fuel: 52,
    wind: { x: 6.5, z: 2.5 },
    finish: 'land',
    rings: [
      ring(-420, 100, -80, 320),
      ring(-900, 110, 260, 260),
      ring(-1300, 100, 700, 230),
      ring(-1560, 90, 1150, 200),
      ring(-1650, 80, 1420, 180),
      ring(-1500, 95, 1780, 120),
    ],
  },
  {
    id: 'home-at-dusk',
    name: 'Home at Dusk',
    brief: 'The last post of the day: a full circuit of the archipelago — coast, canyon mouth, the Anvil shoulder, Gull Rock — and a landing into the sunset on the home strip. Bring her back whole.',
    startMode: 'ground',
    fuel: 100,
    wind: { x: 1.6, z: -1.2 },
    finish: 'land',
    rings: [
      ring(300, 120, -300, 45),
      ring(riverCentreX(-700), 130, -700, 350),
      ring(1250, 375, -1150, 80),
      ring(1950, 190, 700, 130),
      ring(1500, 110, 1250, 210),
      ring(500, 95, 1150, 260),
      ring(-80, 85, 800, 320),
    ],
  },
];

// Builds the ring meshes for one mission and tracks progress through them.
// The active ring burns bright and breathes; flown rings turn green and
// sink away; rings still to come wait dimmer down the course.
export function createCourse(scene, mission) {
  const group = new THREE.Group();
  const ringGeo = new THREE.TorusGeometry(RING_RADIUS, 2.1, 10, 36);
  const discGeo = new THREE.CircleGeometry(RING_RADIUS, 36);
  const meshes = mission.rings.map((r, i) => {
    const holder = new THREE.Group();
    // fog: false — a course beacon must burn through the dusk haze at any
    // range, or the pilot (and the screenshots) cannot read the course.
    const torus = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffa63e, transparent: true, opacity: 0.95, fog: false }),
    );
    holder.add(torus);
    const disc = new THREE.Mesh(
      discGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffc46b,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    );
    holder.add(disc);
    holder.position.set(r.x, r.y, r.z);
    holder.rotation.y = (-r.faceDeg * Math.PI) / 180;
    group.add(holder);
    return { holder, torus, disc, data: r, index: i };
  });
  scene.add(group);

  const course = {
    mission,
    group,
    meshes,
    nextIndex: 0,
    flown: 0,
    time: 0,

    get done() {
      return this.nextIndex >= this.meshes.length;
    },

    get next() {
      return this.done ? null : this.meshes[this.nextIndex];
    },

    // Call every frame with the plane's previous and current positions:
    // a ring counts when the segment crosses its plane inside the circle.
    update(dt, prevPos, pos, events) {
      this.time += dt;
      const active = this.next;
      for (const m of this.meshes) {
        const isActive = m === active;
        const passed = m.index < this.nextIndex;
        m.torus.material.color.setHex(passed ? 0x3ddc74 : isActive ? 0xffa63e : 0xb46a28);
        m.torus.material.opacity = passed ? 0.35 : isActive ? 1 : 0.6;
        m.disc.material.opacity = passed ? 0.03 : isActive ? 0.16 : 0.06;
        if (isActive) {
          const pulse = 1 + Math.sin(this.time * 4.2) * 0.045;
          m.holder.scale.set(pulse, pulse, pulse);
        } else {
          m.holder.scale.set(1, 1, 1);
        }
      }
      if (!active) return;
      const r = active.data;
      // Ring plane: normal along the direction of travel.
      const rad = (r.faceDeg * Math.PI) / 180;
      const nx = Math.sin(rad);
      const nz = -Math.cos(rad);
      const dPrev = (prevPos.x - r.x) * nx + (prevPos.z - r.z) * nz;
      const dNow = (pos.x - r.x) * nx + (pos.z - r.z) * nz;
      if (dPrev === 0 || dPrev * dNow > 0) return; // no crossing this frame
      const t = dPrev / (dPrev - dNow);
      const cx = prevPos.x + (pos.x - prevPos.x) * t;
      const cy = prevPos.y + (pos.y - prevPos.y) * t;
      const cz = prevPos.z + (pos.z - prevPos.z) * t;
      const dist = Math.sqrt((cx - r.x) ** 2 + (cy - r.y) ** 2 + (cz - r.z) ** 2);
      if (dist <= RING_RADIUS + 4) {
        this.nextIndex += 1;
        this.flown += 1;
        events.push({ type: 'ring', index: this.flown, total: this.meshes.length });
      }
    },

    dispose(sceneToClean) {
      sceneToClean.remove(this.group);
    },
  };
  return course;
}

// Where a mission's final approach should aim: the near threshold.
export function landingTarget() {
  return { x: RUNWAY.x, y: RUNWAY.elevation, z: RUNWAY.zTo };
}
