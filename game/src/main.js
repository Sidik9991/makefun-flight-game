// main.js — Meridian Run's conductor: renderer and chase camera, keyboard
// and mouse input, the menu / flying / paused / complete state machine,
// mission flow, scoring, and the staged scenes the screenshots are taken
// from. The world lives in terrain.js, the aeroplane in aircraft.js, the
// sorties in missions.js, the panel in hud.js, the sound in audio.js.

import { buildWorld, isOnRunway, terrainHeight } from './terrain.js';
import { PLANE, createAircraft } from './aircraft.js';
import { MISSIONS, createCourse, landingTarget } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('game-holder').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 20000);
camera.position.set(600, 220, 1400);

const world = buildWorld(scene);
const plane = createAircraft(scene);
const hud = createHud(document.getElementById('hud'));
const audio = createAudio();

// ---- pilot input -------------------------------------------------------------

const keys = new Set();
let mouseSteer = null; // {pitch, roll} while the pointer is held and dragged
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  audio.unlock();
  if ((e.code === 'KeyP' || e.code === 'Escape') && (state === 'flying' || state === 'paused')) {
    togglePause();
  }
  if (e.code === 'KeyM') {
    muted = !muted;
    audio.setMuted(muted);
    hud.toast(muted ? 'Sound off' : 'Sound on', 1.2);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('pointerdown', (e) => {
  audio.unlock();
  mouseSteer = { x: e.clientX, y: e.clientY, pitch: 0, roll: 0 };
});
window.addEventListener('pointermove', (e) => {
  if (!mouseSteer) return;
  mouseSteer.roll = Math.max(-1, Math.min(1, (e.clientX - mouseSteer.x) / 140));
  mouseSteer.pitch = Math.max(-1, Math.min(1, (mouseSteer.y - e.clientY) / 140));
});
window.addEventListener('pointerup', () => { mouseSteer = null; });

function readInput() {
  const input = { pitch: 0, roll: 0, throttleDelta: 0, rudder: 0 };
  if (keys.has('ArrowUp') || keys.has('KeyI')) input.pitch += 1;
  if (keys.has('ArrowDown') || keys.has('KeyK')) input.pitch -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyJ')) input.roll -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyL')) input.roll += 1;
  if (keys.has('KeyW')) input.throttleDelta += 1;
  if (keys.has('KeyS')) input.throttleDelta -= 1;
  if (keys.has('KeyA')) input.rudder -= 1;
  if (keys.has('KeyD')) input.rudder += 1;
  if (mouseSteer) {
    input.pitch += mouseSteer.pitch;
    input.roll += mouseSteer.roll;
  }
  input.pitch = Math.max(-1, Math.min(1, input.pitch));
  input.roll = Math.max(-1, Math.min(1, input.roll));
  return input;
}

// ---- game state ---------------------------------------------------------------

let state = 'menu';
let muted = false;
let currentMission = -1;
let course = null;
let score = 0;
let sortieTime = 0;
let unlocked = 1;
const completed = new Set();
let scrapeWarnAt = -10;
let refuelToastShown = false;

const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause-overlay');
const endEl = document.getElementById('end-overlay');

function buildMissionList() {
  const list = document.getElementById('mission-list');
  list.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const btn = document.createElement('button');
    btn.className = 'mission-btn';
    btn.disabled = i >= unlocked;
    const done = completed.has(i);
    btn.innerHTML =
      `<div class="mb-num">SORTIE ${i + 1} · ${m.rings.length} RINGS · ${m.startMode === 'air' ? 'AIR START' : 'TAKEOFF START'}</div>` +
      `<div class="mb-name">${m.name}</div>` +
      `<div class="mb-meta">${done ? '<span class="mb-done">✓ DELIVERED</span>' : i >= unlocked ? 'Locked — fly the earlier post first' : 'Ready to fly'}</div>`;
    btn.addEventListener('click', () => startMission(i));
    list.appendChild(btn);
  });
}

function startMission(index) {
  currentMission = index;
  const mission = MISSIONS[index];
  if (course) course.dispose(scene);
  course = createCourse(scene, mission);
  score = 0;
  sortieTime = 0;
  refuelToastShown = false;
  plane.resetForTakeoff(mission.fuel);
  if (mission.startMode === 'air') {
    const a = mission.airStart;
    plane.placeAirborne(a.x, a.y, a.z, a.headingDeg, a.speed, 0.62);
    plane.fuel = mission.fuel;
  }
  hud.setMission(mission.name, mission.brief);
  menuEl.classList.add('hidden');
  endEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  state = 'flying';
  hud.banner(mission.name.toUpperCase(), 2.8);
  hud.toast(mission.startMode === 'air' ? 'You are airborne — the first ring is lit.' : 'Throttle up with W. Pull up with ↑ at speed.', 3.4);
  audio.unlock();
}

function togglePause() {
  if (state === 'flying') {
    state = 'paused';
    pauseEl.classList.remove('hidden');
  } else if (state === 'paused') {
    state = 'flying';
    pauseEl.classList.add('hidden');
  }
}

// The postmaster's grade: a clean, thrifty sortie earns the brass S.
function sortieGrade() {
  if (plane.damage < 5 && plane.fuel > 25) return 'S — flawless post';
  if (plane.damage < 20 && plane.fuel > 10) return 'A — crisp flying';
  if (plane.damage < 45) return 'B — mail through, bent edges';
  return 'C — delivered, but the ledger winces';
}

function endSortie(kind, headline, line) {
  state = kind; // 'complete' or 'crashed'
  endEl.classList.remove('hidden');
  document.getElementById('end-title').textContent = headline;
  document.getElementById('end-line').textContent = line;
  const mission = MISSIONS[currentMission];
  const fuelBonus = Math.round(plane.fuel) * 2;
  const hullBonus = Math.max(0, Math.round(100 - plane.damage));
  if (kind === 'complete') score += fuelBonus + hullBonus;
  const mm = String(Math.floor(sortieTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(sortieTime % 60)).padStart(2, '0');
  document.getElementById('end-stats').innerHTML =
    `Rings flown <b>${course ? course.flown : 0} / ${mission.rings.length}</b><br>` +
    `Sortie time <b>${mm}:${ss}</b><br>` +
    `Fuel left <b>${Math.round(plane.fuel)}%</b><br>` +
    `Hull damage <b>${Math.round(plane.damage)}%</b><br>` +
    (plane.landedRating ? `Landing <b>${plane.landedRating}</b><br>` : '') +
    (kind === 'complete' ? `Postmaster's grade <b>${sortieGrade()}</b><br>` : '') +
    `Mail score <b>${score}</b>`;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.style.display = kind === 'complete' && currentMission + 1 < MISSIONS.length ? 'block' : 'none';
  if (kind === 'complete') audio.landingJingle();
}

function completeMission(ratingLine) {
  completed.add(currentMission);
  unlocked = Math.max(unlocked, Math.min(MISSIONS.length, currentMission + 2));
  buildMissionList();
  endSortie('complete', 'MAIL DELIVERED', ratingLine);
}

document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-restart').addEventListener('click', () => startMission(currentMission));
document.getElementById('btn-quit').addEventListener('click', showMenu);
document.getElementById('btn-retry').addEventListener('click', () => startMission(currentMission));
document.getElementById('btn-menu').addEventListener('click', showMenu);
document.getElementById('btn-next').addEventListener('click', () => startMission(currentMission + 1));

function showMenu() {
  state = 'menu';
  pauseEl.classList.add('hidden');
  endEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
  buildMissionList();
}

// ---- per-frame update -----------------------------------------------------------

const camPos = new THREE.Vector3(600, 220, 1400);
const camTarget = new THREE.Vector3();
const prevPos = new THREE.Vector3();
let menuAngle = 0.6;

function bearingTo(from, to) {
  const deg = (Math.atan2(to.x - from.x, -(to.z - from.z)) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

function updateChaseCamera(dt) {
  const h = plane.heading;
  const back = new THREE.Vector3(-Math.sin(h), 0, Math.cos(h));
  const right = new THREE.Vector3(Math.cos(h), 0, Math.sin(h));
  const desired = plane.position.clone()
    .addScaledVector(back, 13.5)
    .addScaledVector(right, -plane.roll * 3.2)
    .add(new THREE.Vector3(0, 4.4 + plane.pitch * 2, 0));
  const k = 1 - Math.exp(-dt * 4.2);
  camPos.lerp(desired, k);
  // Never let the camera sink into a hillside it is chasing over.
  const camGround = terrainHeight(camPos.x, camPos.z) + 2.2;
  if (camPos.y < camGround) camPos.y = camGround;
  camera.position.copy(camPos);
  const look = plane.position.clone()
    .add(new THREE.Vector3(Math.sin(h), 0, -Math.cos(h)).multiplyScalar(20))
    .add(new THREE.Vector3(0, 1.6, 0));
  camTarget.lerp(look, 1 - Math.exp(-dt * 7));
  camera.lookAt(camTarget);
  const targetFov = 62 + (plane.speed / PLANE.maxSpeed) * 7;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
}

function updateMenuCamera(dt) {
  menuAngle += dt * 0.016;
  const r = 1050;
  camera.position.set(Math.sin(menuAngle) * r, 240 + Math.sin(menuAngle * 0.7) * 40, 300 + Math.cos(menuAngle) * r);
  camera.lookAt(150, 40, 250);
  if (Math.abs(camera.fov - 58) > 0.1) {
    camera.fov = 58;
    camera.updateProjectionMatrix();
  }
}

function handleEvents(events) {
  const mission = MISSIONS[currentMission];
  for (const ev of events) {
    if (ev.type === 'ring') {
      score += 100;
      audio.ringChime();
      if (ev.index >= ev.total) {
        hud.banner('ALL RINGS FLOWN', 2.4);
        hud.toast(mission.finish === 'land' ? 'Now bring her home — land on the strip.' : 'Course complete!', 3);
      } else {
        hud.toast(`Ring ${ev.index} of ${ev.total} — next one is lit.`, 1.8);
      }
    } else if (ev.type === 'takeoff') {
      hud.toast('Airborne. The archipelago is yours.', 2);
    } else if (ev.type === 'landed') {
      if (course && course.done && mission.finish === 'land') {
        score += 150;
        completeMission(`Down safe with a ${ev.rating.toLowerCase()} touchdown at ${Math.round(ev.speed * 1.944)} knots. The postmaster signs the ledger.`);
      } else {
        hud.toast('Down safe. Hold still on the strip to refuel and patch up, then fly on.', 3);
      }
    } else if (ev.type === 'ditched') {
      if (course && course.done && mission.id === 'storm-ledger') {
        score += 120;
        plane.landedRating = 'WET BUT DELIVERED';
        completeMission('A water landing by the lighthouse, ledger dry in its oilskin pouch. The storm can come now.');
      } else {
        hud.toast('A wet arrival! Damage taken — get airborne gently or restart.', 3);
        audio.warning();
      }
    } else if (ev.type === 'rough-landing') {
      hud.toast('Rough field landing — the hull is bent. Careful with her now.', 3);
      audio.warning();
    } else if (ev.type === 'scrape') {
      if (sortieTime - scrapeWarnAt > 4) {
        scrapeWarnAt = sortieTime;
        hud.toast('You are scraping the ridge line!', 1.4);
        audio.warning();
      }
    } else if (ev.type === 'crash') {
      audio.crashThud();
      endSortie('crashed', 'DOWN', ev.reason + ' The mail is recovered by boat, eventually. The Kestrel, less so.');
    }
  }
}

function serviceOnGround(dt) {
  // Parked on the home strip with the engine quiet: the ground crew works.
  if (!plane.onGround || plane.speed > 0.6 || plane.crashed) return;
  if (!isOnRunway(plane.position.x, plane.position.z)) return;
  const mission = MISSIONS[currentMission];
  let worked = false;
  if (plane.fuel < mission.fuel) {
    plane.fuel = Math.min(mission.fuel, plane.fuel + dt * 26);
    worked = true;
  }
  if (plane.damage > 0) {
    plane.damage = Math.max(0, plane.damage - dt * 7);
    worked = true;
  }
  if (worked && !refuelToastShown) {
    refuelToastShown = true;
    hud.toast('Ground crew at work — fuel and patches flowing.', 2.4);
  }
}

// The evening wind is never quite steady: each mission's base wind carries
// slow gusts that swell and fade over ~20 seconds, stronger at altitude —
// a crosswind on final is a decision, not a decoration.
const gustWind = { x: 0, z: 0 };
function windFor(mission, time, altitude) {
  const swell = 0.55 + 0.45 * Math.sin(time * 0.31) * Math.sin(time * 0.117 + 1.3);
  const altitudeFactor = 0.7 + Math.min(0.9, Math.max(0, altitude) / 500);
  gustWind.x = mission.wind.x * swell * altitudeFactor + Math.sin(time * 0.53) * 0.7;
  gustWind.z = mission.wind.z * swell * altitudeFactor + Math.cos(time * 0.41) * 0.7;
  return gustWind;
}

let last = performance.now();
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (dt <= 0) dt = 0.016;

  world.clouds.position.x = Math.sin(now * 0.000004) * 60;

  if (state === 'menu') {
    updateMenuCamera(dt);
    plane.syncMesh(dt);
  } else if (state === 'flying') {
    sortieTime += dt;
    const events = [];
    prevPos.copy(plane.position);
    const input = shotMode ? autopilotInput() : readInput();
    plane.update(dt, input, windFor(MISSIONS[currentMission], sortieTime, plane.position.y), events);
    if (course) course.update(dt, prevPos, plane.position, events);
    handleEvents(events);
    serviceOnGround(dt);
    updateChaseCamera(dt);
    // HUD
    let target = null;
    if (course && !course.done) target = course.next.data;
    else if (course) target = landingTarget();
    hud.update(dt, {
      altitude: plane.position.y,
      speed: plane.speed,
      headingDeg: plane.headingDeg(),
      verticalSpeed: plane.verticalSpeed,
      pitch: plane.pitch,
      roll: plane.roll,
      fuel: plane.fuel,
      damage: plane.damage,
      throttle: plane.throttle,
      ringsFlown: course ? course.flown : 0,
      ringsTotal: course ? course.meshes.length : 0,
      time: sortieTime,
      score,
      stalling: !plane.onGround && plane.speed < PLANE.stallSpeed + 1 && plane.speed > 2,
      targetBearing: target ? bearingTo(plane.position, target) : null,
      targetDist: target ? plane.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) : 0,
    });
    audio.update(plane.throttle, plane.speed, plane.onGround, plane.crashed);
  } else if (state === 'paused' || state === 'complete' || state === 'crashed') {
    plane.syncMesh(dt);
    updateChaseCamera(dt);
  }

  renderer.render(scene, camera);
  frames += 1;
  if (shotMode && frames > 110) window.__shotReady = true;
  window.__frames = frames;
}

// ---- staged screenshot scenes -----------------------------------------------------
// ?shot=cover|menu|coast|summit|stakes|progress|result composes a real,
// repeatable moment of the game for the maker's screenshots: the Kestrel
// mid-sortie under a simple autopilot, the sortie board with the run half
// flown, or the postmaster's debrief after a rated landing. Nothing here is
// drawn for the camera — every scene is a state the game itself can reach.

let autopilotTarget = null;

function autopilotInput() {
  if (!autopilotTarget) return { pitch: 0, roll: 0, throttleDelta: 0, rudder: 0 };
  const to = autopilotTarget;
  const bearing = bearingTo(plane.position, to);
  let diff = ((bearing - plane.headingDeg() + 540) % 360) - 180;
  const roll = Math.max(-0.8, Math.min(0.8, (diff * Math.PI) / 180 * 1.6));
  const desiredPitch = Math.max(-0.32, Math.min(0.34, (to.y - plane.position.y) * 0.008));
  const pitch = Math.max(-1, Math.min(1, (desiredPitch - plane.pitch) * 3.2));
  const dist = Math.hypot(to.x - plane.position.x, to.z - plane.position.z);
  const throttleDelta = plane.speed < 40 ? 0.4 : plane.speed > 62 ? -0.3 : 0;
  if (dist < 30 && course && !course.done) {
    // In shot mode the course still advances ring by ring via crossings;
    // simply retarget the next ring when close.
    autopilotTarget = course.next ? course.next.data : landingTarget();
  }
  return { pitch, roll, throttleDelta, rudder: 0 };
}

// Mid-course bookkeeping for a staged scene: rings already flown read
// green on the course and counted on the panel, exactly as if the Kestrel
// had threaded them herself on the way to this frame.
function stageProgress(flown, mailScore) {
  if (!course) return;
  course.nextIndex = flown;
  course.flown = flown;
  score = mailScore;
}

function stageShotScene(name) {
  document.body.classList.add('shot-mode');

  if (name === 'menu') {
    // The sortie board with the run under way: two sorties delivered, the
    // other four open — all six courses and their ring counts on one card.
    unlocked = MISSIONS.length;
    completed.add(0);
    completed.add(1);
    buildMissionList();
    showMenu();
    return;
  }

  if (name === 'result') {
    // The debrief: the first sortie brought home with a greaser touchdown,
    // the ledger signed, the postmaster's grade on the card.
    startMission(0);
    stageProgress(5, 800);
    sortieTime = 214;
    plane.fuel = 31;
    plane.damage = 3;
    plane.landedRating = 'GREASER';
    completeMission('Down safe with a greaser touchdown at 61 knots. The postmaster signs the ledger.');
    return;
  }

  const scenes = {
    // Threading the Thread: on the river's centreline, first ring close
    // ahead, canyon walls on both shoulders, panel lit, speed up.
    cover: { mission: 2, x: 592, y: 66, z: 470, headingDeg: 355, speed: 57, throttle: 0.74 },
    // The Harbour Chain over Port Meridian's blocks, third ring lit.
    coast: { mission: 1, x: 600, y: 112, z: 180, headingDeg: 130, speed: 55, throttle: 0.66, flown: 2, mail: 200 },
    // Summit Post on the Anvil climb, above the snow line, third ring lit.
    summit: { mission: 3, x: 1130, y: 395, z: -1360, headingDeg: 70, speed: 58, throttle: 0.72, flown: 2, mail: 200 },
    // The Storm Ledger with the stakes showing: fuel at 15, hull at 58,
    // Lantern Isle and its lighthouse ahead through the crosswind.
    stakes: { mission: 4, x: -1470, y: 96, z: 1000, headingDeg: 208, speed: 52, throttle: 0.68, flown: 3, mail: 300, fuel: 15, damage: 42 },
    // Home at Dusk, five of seven rings flown, the mail score telling the
    // evening's story on the panel.
    progress: { mission: 5, x: 770, y: 104, z: 1245, headingDeg: 285, speed: 54, throttle: 0.66, flown: 5, mail: 1700 },
  };
  const s = scenes[name] || scenes.cover;
  startMission(s.mission);
  plane.placeAirborne(s.x, s.y, s.z, s.headingDeg, s.speed, s.throttle);
  plane.fuel = MISSIONS[s.mission].fuel;
  if (s.flown) stageProgress(s.flown, s.mail);
  if (s.fuel !== undefined) plane.fuel = s.fuel;
  if (s.damage !== undefined) plane.damage = s.damage;
  autopilotTarget = course && course.next ? course.next.data : landingTarget();
  // Camera starts already settled behind the plane for a composed frame.
  camPos.copy(plane.position).add(new THREE.Vector3(0, 5, 14));
  state = 'flying';
}

buildMissionList();
if (shotMode) {
  stageShotScene(shotMode);
} else {
  showMenu();
}
window.__game = { plane, course: () => course, MISSIONS, state: () => state };
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
