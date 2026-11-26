// aircraft.js — the aeroplane: the Kestrel K-6 seaplane model (fuselage,
// high wing, twin floats, spinning prop, lit nav lights) and its flight
// model — throttle discipline, coordinated turns, stall, wind drift, fuel
// burn, hull damage and rated landings. Everything about the plane itself
// lives here; the world and the missions live elsewhere.

import { RUNWAY, terrainHeight } from './terrain.js';

export const PLANE = {
  maxSpeed: 96, // m/s at full throttle
  cruiseSpeed: 55,
  stallSpeed: 21,
  minGroundSpeed: 0,
  fuelCapacity: 100,
  rotateSpeed: 26, // below this she will not lift off
};

const paint = {
  cream: new THREE.MeshLambertMaterial({ color: 0xf0e3c8 }),
  red: new THREE.MeshLambertMaterial({ color: 0xb23a2e }),
  dark: new THREE.MeshLambertMaterial({ color: 0x2e3138 }),
  glass: new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 120, specular: 0xffffff }),
  brass: new THREE.MeshLambertMaterial({ color: 0xc9963c }),
};

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function buildKestrelMesh() {
  const g = new THREE.Group();
  // Fuselage: a tapered hull built from stacked boxes, nose at -Z.
  const hull = box(2.2, 2.0, 9.6, paint.cream, 0, 0, 0.4);
  g.add(hull);
  const nose = box(1.9, 1.7, 2.2, paint.red, 0, -0.05, -4.6);
  g.add(nose);
  const tailCone = box(1.2, 1.1, 3.4, paint.cream, 0, 0.35, 6.2);
  g.add(tailCone);
  // Cockpit glasshouse with a warm lit interior glow.
  const canopy = box(1.7, 1.0, 2.6, paint.glass, 0, 1.25, -0.7);
  g.add(canopy);
  const cabinGlow = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.5, 2.2),
    new THREE.MeshBasicMaterial({ color: 0xffc46b }),
  );
  cabinGlow.position.set(0, 1.05, -0.7);
  g.add(cabinGlow);
  // High wing with red tips, slight dihedral faked by two panels.
  const wingL = box(6.4, 0.28, 2.0, paint.cream, -3.6, 1.85, -0.6);
  wingL.rotation.z = 0.05;
  g.add(wingL);
  const wingR = box(6.4, 0.28, 2.0, paint.cream, 3.6, 1.85, -0.6);
  wingR.rotation.z = -0.05;
  g.add(wingR);
  const tipL = box(1.1, 0.3, 2.0, paint.red, -6.9, 2.02, -0.6);
  tipL.rotation.z = 0.05;
  g.add(tipL);
  const tipR = box(1.1, 0.3, 2.0, paint.red, 6.9, 2.02, -0.6);
  tipR.rotation.z = -0.05;
  g.add(tipR);
  // Wing struts down to the floats.
  for (const sx of [-2.6, 2.6]) {
    const strut = box(0.16, 2.6, 0.16, paint.dark, sx, 0.4, -0.6);
    strut.rotation.z = sx > 0 ? 0.5 : -0.5;
    g.add(strut);
  }
  // Tail: horizontal stabiliser and a tall red fin with the mail star.
  g.add(box(4.6, 0.24, 1.5, paint.cream, 0, 0.75, 7.6));
  const fin = box(0.24, 2.6, 1.9, paint.red, 0, 1.9, 7.4);
  g.add(fin);
  // Twin floats on struts — she is a seaplane, and the floats are her gear.
  for (const fx of [-1.5, 1.5]) {
    const float = box(0.85, 0.8, 7.4, paint.red, fx, -2.15, -0.2);
    g.add(float);
    const step = box(0.85, 0.5, 2.4, paint.dark, fx, -1.7, 0.6);
    g.add(step);
    for (const fz of [-1.8, 1.6]) {
      const leg = box(0.14, 1.5, 0.14, paint.dark, fx, -1.3, fz);
      leg.rotation.x = fz > 0 ? 0.35 : -0.35;
      g.add(leg);
    }
  }
  // Propeller: spinner cone plus two blades, spun by the engine each frame.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 10), paint.brass);
  spinner.rotation.x = -Math.PI / 2;
  prop.add(spinner);
  const bladeMat = paint.dark;
  const blade1 = box(0.34, 4.6, 0.1, bladeMat, 0, 0, -0.2);
  prop.add(blade1);
  const blade2 = box(4.6, 0.34, 0.1, bladeMat, 0, 0, -0.2);
  prop.add(blade2);
  prop.position.set(0, -0.05, -5.85);
  g.add(prop);
  // Exhaust stubs and a brass mail hatch — the details that say "built".
  g.add(box(0.3, 0.3, 1.6, paint.dark, 1.15, -0.7, -3.4));
  g.add(box(1.2, 0.9, 0.12, paint.brass, 0, 0.1, 3.4));
  // Nav lights: red port, green starboard, white tail — lit, always on.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  navL.position.set(-7.45, 2.05, -0.6);
  g.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2eff7a }));
  navR.position.set(7.45, 2.05, -0.6);
  g.add(navR);
  const navT = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navT.position.set(0, 0.8, 8.4);
  g.add(navT);
  // Landing light in the nose for the dusk approach.
  const beam = new THREE.SpotLight(0xffe2b0, 1.4, 260, 0.32, 0.5, 1);
  beam.position.set(0, -0.4, -5.4);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, -3, -60);
  g.add(beamTarget);
  beam.target = beamTarget;
  g.add(beam);
  return { group: g, prop };
}

// The aeroplane's live state. Angles in radians, heading 0 = north.
export function createAircraft(scene) {
  const { group, prop } = buildKestrelMesh();
  scene.add(group);
  const plane = {
    mesh: group,
    prop,
    position: new THREE.Vector3(RUNWAY.x, RUNWAY.elevation + 2.6, RUNWAY.zTo - 60),
    heading: Math.PI, // parked facing south, ready to roll north... flipped below
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    verticalSpeed: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    engineOn: true,
    onGround: true,
    crashed: false,
    crashReason: '',
    landedRating: null,

    resetForTakeoff(fuelAmount) {
      // South end of the strip, nose north (heading 0): the full length of
      // runway lies ahead of her for the takeoff roll.
      this.position.set(RUNWAY.x, RUNWAY.elevation + 2.6, RUNWAY.zTo - 40);
      this.heading = 0;
      this.pitch = 0;
      this.roll = 0;
      this.speed = 0;
      this.throttle = 0;
      this.verticalSpeed = 0;
      this.fuel = fuelAmount;
      this.damage = 0;
      this.engineOn = true;
      this.onGround = true;
      this.crashed = false;
      this.crashReason = '';
      this.landedRating = null;
      this.syncMesh(0);
    },

    placeAirborne(x, y, z, headingDeg, speed, throttle) {
      this.position.set(x, y, z);
      this.heading = (headingDeg * Math.PI) / 180;
      this.pitch = 0;
      this.roll = 0;
      this.speed = speed;
      this.throttle = throttle;
      this.verticalSpeed = 0;
      this.onGround = false;
      this.crashed = false;
      this.syncMesh(0);
    },

    headingDeg() {
      const deg = (this.heading * 180) / Math.PI;
      return ((deg % 360) + 360) % 360;
    },

    altitudeAGL() {
      return this.position.y - terrainHeight(this.position.x, this.position.z);
    },

    // One physics step. input: {pitch, roll, throttleDelta, rudder}.
    // events collects what happened: 'takeoff', 'landed', 'crash', 'scrape'.
    update(dt, input, wind, events) {
      if (this.crashed) return;
      // --- engine and speed -------------------------------------------------
      if (input.throttleDelta) {
        this.throttle = Math.min(1, Math.max(0, this.throttle + input.throttleDelta * dt * 0.55));
      }
      const burning = this.engineOn && this.fuel > 0;
      if (burning) {
        this.fuel = Math.max(0, this.fuel - dt * (0.14 + this.throttle * 0.5));
      }
      const thrust = burning ? this.throttle : 0;
      const targetSpeed = thrust * PLANE.maxSpeed;
      const accel = targetSpeed > this.speed ? 7.5 : 4.5;
      // Pitching the nose down trades height for speed and back.
      const energyTrade = -Math.sin(this.pitch) * 9.5;
      this.speed += Math.max(-accel, Math.min(accel, (targetSpeed - this.speed) * 0.35 + energyTrade)) * dt;
      if (this.onGround && thrust === 0) this.speed = Math.max(0, this.speed - 14 * dt);
      this.speed = Math.max(0, this.speed);
      // --- attitude -----------------------------------------------------------
      const authority = Math.min(1, 0.25 + this.speed / PLANE.cruiseSpeed); // controls bite with airflow
      if (!this.onGround) {
        this.pitch += input.pitch * dt * 0.85 * authority;
        this.pitch = Math.max(-0.85, Math.min(0.95, this.pitch));
        this.pitch *= 1 - 0.35 * dt; // gentle return toward trim
        const targetRoll = input.roll * 1.05;
        this.roll += (targetRoll - this.roll) * Math.min(1, dt * 3.2);
        // Coordinated turn: bank becomes heading change — bank right
        // (roll > 0) swings the compass heading up, toward the east.
        this.heading += Math.sin(this.roll) * (this.speed / 46) * dt * 0.9;
        this.heading += (input.rudder || 0) * dt * 0.25 * authority;
      } else {
        // On the roll, steering is the rudder; pitch only matters at rotate speed.
        this.heading += (input.roll || 0) * dt * (this.speed / 30) * 0.5;
        if (this.speed >= PLANE.rotateSpeed && input.pitch > 0) {
          this.pitch = Math.min(0.3, this.pitch + input.pitch * dt * 0.5);
        } else if (input.pitch <= 0) {
          this.pitch = Math.max(0, this.pitch - dt * 0.8);
        }
        this.roll *= 1 - 4 * dt;
      }
      // --- motion -------------------------------------------------------------
      const sinH = Math.sin(this.heading);
      const cosH = Math.cos(this.heading);
      const climbRate = Math.sin(this.pitch) * this.speed;
      // Lift holds her up in proportion to speed; below the stall she sinks.
      const lift = Math.min(1, this.speed / PLANE.stallSpeed);
      const sink = (1 - lift) * (1 - lift) * 11;
      this.verticalSpeed = this.onGround && this.pitch <= 0.02 ? 0 : climbRate - (this.onGround ? 0 : sink);
      this.position.x += sinH * Math.cos(this.pitch) * this.speed * dt + wind.x * dt;
      this.position.z += -cosH * Math.cos(this.pitch) * this.speed * dt + wind.z * dt;
      this.position.y += this.verticalSpeed * dt;
      // --- ground contact -------------------------------------------------------
      const groundY = terrainHeight(this.position.x, this.position.z);
      const floatClearance = 2.6;
      if (this.position.y <= groundY + floatClearance) {
        const onStrip = Math.abs(this.position.x - RUNWAY.x) <= RUNWAY.width / 2 + 2 &&
          this.position.z >= RUNWAY.zFrom - 10 && this.position.z <= RUNWAY.zTo + 10;
        if (!this.onGround) {
          const sinkAtTouch = -this.verticalSpeed;
          const aligned = Math.min(Math.abs(this.headingDeg()), Math.abs(360 - this.headingDeg())) < 22 ||
            Math.abs(this.headingDeg() - 180) < 22;
          if (onStrip && aligned && sinkAtTouch < 4.2 && this.speed < 44) {
            this.onGround = true;
            this.position.y = RUNWAY.elevation + floatClearance;
            this.pitch = 0;
            this.roll = 0;
            this.landedRating = rateLanding(sinkAtTouch, this.speed);
            events.push({ type: 'landed', rating: this.landedRating, sink: sinkAtTouch, speed: this.speed });
          } else if (groundY <= 0.4 && sinkAtTouch < 2.2 && this.speed < 30) {
            // A seaplane may set down gently on water: rough, wet, survivable.
            this.onGround = true;
            this.position.y = groundY + floatClearance;
            this.damage = Math.min(100, this.damage + 12);
            events.push({ type: 'ditched', sink: sinkAtTouch });
          } else if (sinkAtTouch < 2.6 && this.speed < 26 && groundY > 4) {
            // Belly-down on gentle land: a rough field landing that bends things.
            this.onGround = true;
            this.position.y = groundY + floatClearance;
            this.damage = Math.min(100, this.damage + 28);
            this.speed = Math.min(this.speed, 6);
            events.push({ type: 'rough-landing', sink: sinkAtTouch });
            if (this.damage >= 100) this.crash('The airframe gave out after one knock too many.', events);
          } else {
            this.crash(
              groundY <= 0.4 ? 'She went into the sea too hard.' :
              onStrip ? 'The arrival was more than the floats could take.' :
              'Terrain rose to meet her — a hillside at flying speed.',
              events,
            );
          }
        } else {
          // Rolling: keep her glued to the strip/field.
          this.position.y = (onStrip ? RUNWAY.elevation : groundY) + floatClearance;
          if (this.pitch > 0.1 && this.speed >= PLANE.rotateSpeed) {
            this.onGround = false;
            events.push({ type: 'takeoff' });
          }
          if (!onStrip && groundY > 4 && this.speed > 34) {
            this.crash('She ran out of field and into the rough.', events);
          }
        }
      } else if (this.onGround && this.position.y > groundY + floatClearance + 1.5) {
        this.onGround = false; // rolled off a crest
      }
      // Scrape: wingtip through a ridge line while turning low.
      if (!this.onGround && this.altitudeAGL() < 3.2 && this.speed > 30) {
        this.damage = Math.min(100, this.damage + dt * 22);
        events.push({ type: 'scrape' });
        if (this.damage >= 100) this.crash('The wing came apart after scraping the ridge.', events);
      }
      // World bounds: turn her home rather than losing her.
      const bound = 3100;
      this.position.x = Math.max(-bound, Math.min(bound, this.position.x));
      this.position.z = Math.max(-bound, Math.min(bound, this.position.z));
      if (this.position.y > 1500) this.position.y = 1500;
      this.syncMesh(dt);
    },

    crash(reason, events) {
      if (this.crashed) return;
      this.crashed = true;
      this.crashReason = reason;
      this.speed = 0;
      this.throttle = 0;
      events.push({ type: 'crash', reason });
    },

    syncMesh(dt) {
      this.mesh.position.copy(this.position);
      // The model's nose is -Z. A Y-rotation of -heading turns that nose to
      // (sin h, 0, -cos h), exactly the physics forward vector. Pitch then
      // rotates about the local X (positive pitch raises the nose) and roll
      // about the local Z (positive roll drops the right, +X, wing).
      this.mesh.rotation.set(0, 0, 0);
      this.mesh.rotateY(-this.heading);
      this.mesh.rotateX(this.pitch);
      this.mesh.rotateZ(-this.roll);
      if (this.prop) {
        const rpm = this.crashed ? 0 : 2 + this.throttle * 55 + (this.speed > 1 ? 6 : 0);
        this.prop.rotation.z += rpm * (dt || 0.016);
      }
    },
  };
  plane.heading = 0;
  plane.resetForTakeoff(PLANE.fuelCapacity);
  return plane;
}

function rateLanding(sink, speed) {
  // A greaser is slow and soft; anything else is graded honestly.
  if (sink < 1.2 && speed < 34) return 'GREASER';
  if (sink < 2.2 && speed < 38) return 'FIRM';
  if (sink < 3.4) return 'HARD';
  return 'TEETH-RATTLING';
}
