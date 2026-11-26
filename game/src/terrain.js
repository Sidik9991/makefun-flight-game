// terrain.js — the Meridian archipelago: one analytic height field that the
// terrain mesh, the flight model and the collision checks all share, so the
// ground the pilot sees is exactly the ground the physics knows about.
//
// Layout (metres, +X east, +Z south, heading 0 = north = -Z):
//   - Meridian Isle, the big home island, centred near (-100, 300): rolling
//     grass hills, the airmail runway on its west plain, Port Meridian city
//     on the east coast and a harbour between them.
//   - The Thread, a river canyon carved across the island's north half.
//   - The Anvil, a mountain massif in the north-east, peaks above 400 m.
//   - Lantern Isle to the south-west with the lighthouse; Gull Rock east.

export const WORLD_SIZE = 6400;
export const SEA_LEVEL = 0;
export const RUNWAY = {
  x: -260, // centreline
  zFrom: 300,
  zTo: 900,
  width: 34,
  elevation: 14,
  headingDeg: 0, // land toward the north (heading 0) or south (180)
};

// Small deterministic hash noise: smooth, cheap, identical on every run so
// screenshots and physics agree frame after frame.
function noise2(x, z) {
  return (
    Math.sin(x * 0.011 + z * 0.017) * 0.5 +
    Math.sin(x * 0.0043 - z * 0.0061 + 1.7) * 0.35 +
    Math.sin((x + z) * 0.021 + 0.6) * 0.15
  );
}

function blob(x, z, cx, cz, radius) {
  const dx = x - cx;
  const dz = z - cz;
  const d2 = (dx * dx + dz * dz) / (radius * radius);
  if (d2 >= 1) return 0;
  const t = 1 - d2;
  return t * t * (3 - 2 * t); // smoothstep falloff
}

// The river's centreline: a lazy S running north across the home island.
export function riverCentreX(z) {
  return 420 + 300 * Math.sin(z * 0.0016) + 90 * Math.sin(z * 0.005 + 1.2);
}

function runwayBlend(x, z) {
  // 1 inside the runway rectangle (with soft shoulders), 0 outside it.
  const halfW = RUNWAY.width / 2 + 46;
  const dx = Math.max(Math.abs(x - RUNWAY.x) - halfW, 0);
  const dz = Math.max(z < RUNWAY.zFrom ? RUNWAY.zFrom - z - 60 : z > RUNWAY.zTo ? z - RUNWAY.zTo - 60 : 0, 0);
  const d = Math.sqrt(dx * dx + dz * dz);
  const t = Math.min(Math.max(d / 130, 0), 1);
  let blend = 1 - t * t * (3 - 2 * t);
  // Approach corridors: a pilot on final must not meet a hillside, so the
  // ground along the centreline's extension is coaxed toward strip level
  // for 800 m past each threshold, fading with distance and offset.
  const cx = Math.abs(x - RUNWAY.x);
  if (cx < 130) {
    const beyond = z < RUNWAY.zFrom ? RUNWAY.zFrom - z : z > RUNWAY.zTo ? z - RUNWAY.zTo : 0;
    if (beyond > 0 && beyond < 800) {
      const along = 1 - beyond / 800;
      const across = 1 - cx / 130;
      const corridor = (along * along * (3 - 2 * along)) * (across * across * (3 - 2 * across)) * 0.92;
      blend = Math.max(blend, corridor);
    }
  }
  return blend;
}

export function terrainHeight(x, z) {
  // Ocean floor well below the surface so the coast shelves gently.
  let h = -14;
  // Home island: broad base plus hill detail.
  const home = blob(x, z, -100, 300, 1500);
  h += home * (64 + noise2(x, z) * 26);
  // Northern shoulder of the home island, feeding the canyon walls.
  h += blob(x, z, 250, -700, 950) * (120 + noise2(x + 900, z) * 40);
  // The Anvil massif, north-east.
  const anvil = blob(x, z, 1550, -1450, 1150);
  h += anvil * (330 + noise2(x - 400, z + 300) * 120);
  h += blob(x, z, 1150, -1750, 420) * 190; // sharpest peak
  // Lantern Isle, south-west, and Gull Rock, east.
  h += blob(x, z, -1650, 1550, 520) * (46 + noise2(x, z - 800) * 10);
  h += blob(x, z, 1950, 950, 720) * (120 + noise2(x + 300, z) * 36);
  // Carve the river canyon where it crosses land in the north.
  if (z > -1750 && z < 500 && h > 2) {
    const dx = Math.abs(x - riverCentreX(z));
    const carve = Math.max(0, 1 - dx / 190);
    const floor = 6 + 3 * Math.sin(z * 0.004);
    h = h - (h - floor) * carve * carve;
    if (dx < 60) h = Math.min(h, floor + dx * 0.08); // flat water channel
  }
  // Flatten the runway plain last so the strip always sits true.
  const rb = runwayBlend(x, z);
  if (rb > 0) h = h * (1 - rb) + RUNWAY.elevation * rb;
  return h;
}

export function isOnRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 &&
    z >= RUNWAY.zFrom &&
    z <= RUNWAY.zTo
  );
}

// ---- three.js scene construction -------------------------------------------

function makeCanvasTexture(draw, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function runwayTexture() {
  return makeCanvasTexture((g, w, h) => {
    g.fillStyle = '#33373c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3c4147';
    for (let i = 0; i < 260; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    g.fillStyle = '#e8e4da';
    g.fillRect(6, 0, 5, h); // edge lines
    g.fillRect(w - 11, 0, 5, h);
    for (let z = 26; z < h - 20; z += 64) g.fillRect(w / 2 - 4, z, 8, 34); // centreline dashes
    for (const end of [0, 1]) {
      // threshold piano keys at both ends
      const y0 = end === 0 ? 4 : h - 40;
      for (let i = 0; i < 6; i++) g.fillRect(18 + i * 34, y0, 18, 36);
    }
    g.save();
    g.translate(w / 2, 108);
    g.fillStyle = '#e8e4da';
    g.font = 'bold 54px sans-serif';
    g.textAlign = 'center';
    g.fillText('27', 0, 0);
    g.restore();
  }, 128, 1024);
}

function cityTexture() {
  return makeCanvasTexture((g, w, h) => {
    g.fillStyle = '#55483c';
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 11) {
      for (let x = 6; x < w - 6; x += 9) {
        const on = Math.random() < 0.55;
        g.fillStyle = on ? (Math.random() < 0.8 ? '#ffd98a' : '#fff3c4') : '#2e2a24';
        g.fillRect(x, y, 5, 6);
      }
    }
  }, 64, 128);
}

function buildGround(scene) {
  const seg = 168;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0xc9a86a);
  const cGrass = new THREE.Color(0x5d7d3c);
  const cDry = new THREE.Color(0x8a8a4d);
  const cRock = new THREE.Color(0x7a6a5e);
  const cSnow = new THREE.Color(0xf3ece2);
  const cFloor = new THREE.Color(0x2c4a3e);
  const warm = new THREE.Color(0xd98a4a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    if (h < 1.5) tmp.copy(cFloor);
    else if (h < 5) tmp.copy(cSand);
    else if (h < 55) tmp.copy(cGrass).lerp(cDry, Math.min(1, Math.max(0, noise2(x * 2, z * 2)) * 0.8));
    else if (h < 210) tmp.copy(cRock).lerp(cGrass, 0.25);
    else tmp.copy(cRock).lerp(cSnow, Math.min(1, (h - 210) / 160));
    // Warm the whole island toward the sunset.
    tmp.lerp(warm, 0.08);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(ground);
}

function buildSea(scene) {
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE * 2.4, WORLD_SIZE * 2.4),
    new THREE.MeshPhongMaterial({
      color: 0x27586b,
      specular: 0xffb36b,
      shininess: 90,
      transparent: true,
      opacity: 0.94,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_LEVEL;
  scene.add(sea);
  // The river: a bright ribbon following the canyon floor. Its height uses
  // the same floor formula as the carve in terrainHeight (plus a step up so
  // the water shows), and the tube is squashed flat to hug the channel.
  const pts = [];
  for (let z = -1700; z <= 480; z += 40) {
    const floorY = 6 + 3 * Math.sin(z * 0.004);
    pts.push(new THREE.Vector3(riverCentreX(z), floorY + 1.1, z));
  }
  const riverGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 26, 5, false);
  const river = new THREE.Mesh(
    riverGeo,
    new THREE.MeshPhongMaterial({ color: 0x3d7d8c, specular: 0xffcf99, shininess: 120 }),
  );
  river.scale.y = 0.12;
  scene.add(river);
}

function buildRunway(scene) {
  const len = RUNWAY.zTo - RUNWAY.zFrom;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width, len),
    new THREE.MeshLambertMaterial({ map: runwayTexture() }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.rotation.z = Math.PI; // numbers read for a northbound landing
  strip.position.set(RUNWAY.x, RUNWAY.elevation + 0.25, (RUNWAY.zFrom + RUNWAY.zTo) / 2);
  scene.add(strip);
  // Edge lights: two rows of warm lamps so the strip reads at dusk.
  const lampGeo = new THREE.SphereGeometry(0.9, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 44);
  const m = new THREE.Matrix4();
  let idx = 0;
  for (let i = 0; i < 22; i++) {
    const z = RUNWAY.zFrom + 12 + (i * (len - 24)) / 21;
    for (const side of [-1, 1]) {
      m.setPosition(RUNWAY.x + side * (RUNWAY.width / 2 + 3), RUNWAY.elevation + 1, z);
      lamps.setMatrixAt(idx++, m);
    }
  }
  scene.add(lamps);
  // PAPI lights by the south threshold: white pair, red pair.
  for (let i = 0; i < 4; i++) {
    const papi = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1, 1),
      new THREE.MeshBasicMaterial({ color: i < 2 ? 0xffffff : 0xff4444 }),
    );
    papi.position.set(RUNWAY.x - RUNWAY.width / 2 - 8, RUNWAY.elevation + 0.8, RUNWAY.zFrom + 18 + i * 2.4);
    scene.add(papi);
  }
  // A windsock beside the threshold, leaning with the evening breeze.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  pole.position.set(RUNWAY.x + 30, RUNWAY.elevation + 4.5, RUNWAY.zFrom + 30);
  scene.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.6, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7a33 }),
  );
  sock.rotation.z = Math.PI / 2.3;
  sock.position.set(RUNWAY.x + 32.4, RUNWAY.elevation + 8.6, RUNWAY.zFrom + 30);
  scene.add(sock);
}

function buildCity(scene) {
  const mats = [cityTexture(), cityTexture(), cityTexture()].map(
    (tex) => new THREE.MeshLambertMaterial({ map: tex }),
  );
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const group = new THREE.Group();
  // Port Meridian: a grid of harbour blocks on the east-coast plain.
  for (let gx = 0; gx < 9; gx++) {
    for (let gz = 0; gz < 11; gz++) {
      if (rand() < 0.22) continue; // streets and yards
      const x = 470 + gx * 74 + (rand() - 0.5) * 18;
      const z = 260 + gz * 62 + (rand() - 0.5) * 14;
      const base = terrainHeight(x, z);
      if (base < 6 || base > 60) continue;
      const height = 14 + rand() * rand() * 62;
      const b = new THREE.Mesh(boxGeo, mats[Math.floor(rand() * mats.length)]);
      b.position.set(x, base - 1, z);
      b.scale.set(30 + rand() * 22, height, 26 + rand() * 18);
      b.rotation.y = (rand() - 0.5) * 0.12;
      group.add(b);
    }
  }
  // Harbour crates south of the city, stacked by the quay.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a5a3a });
  for (let i = 0; i < 26; i++) {
    const crate = new THREE.Mesh(boxGeo, crateMat);
    const x = 330 + rand() * 260;
    const z = 950 + rand() * 90;
    crate.position.set(x, Math.max(terrainHeight(x, z), 2), z);
    crate.scale.set(10, 4 + rand() * 4, 6);
    crate.rotation.y = rand() * 0.8;
    group.add(crate);
  }
  scene.add(group);
}

function scatterForest(scene) {
  // One deterministic walk used for both crowns and trunks, so each trunk
  // stands under its own crown.
  const spots = [];
  let seed = 31;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  while (spots.length < 700) {
    const x = -1500 + rand() * 3000;
    const z = -1500 + rand() * 3200;
    const h = terrainHeight(x, z);
    if (h < 8 || h > 150 || isOnRunway(x, z)) continue;
    if (Math.abs(x - riverCentreX(z)) < 120 && z < 500 && z > -1750) continue;
    spots.push({ x, z, h, scale: 0.8 + rand() * 0.9, rot: rand() * Math.PI });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const place = (mesh, yOff) => {
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.rot);
      m.compose(
        new THREE.Vector3(s.x, s.h + yOff * s.scale, s.z),
        q,
        new THREE.Vector3(s.scale, s.scale, s.scale),
      );
      mesh.setMatrixAt(i, m);
    });
    scene.add(mesh);
  };
  place(
    new THREE.InstancedMesh(
      new THREE.ConeGeometry(3.4, 11, 7),
      new THREE.MeshLambertMaterial({ color: 0x39543a }),
      spots.length,
    ),
    5,
  );
  place(
    new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.7, 4, 5),
      new THREE.MeshLambertMaterial({ color: 0x5a4230 }),
      spots.length,
    ),
    2,
  );
}

function buildLandmarks(scene) {
  // Lighthouse on Lantern Isle: white shaft, red band, lit lamp room.
  const lx = -1650;
  const lz = 1550;
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.6, 30, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
  );
  shaft.position.y = 15;
  tower.add(shaft);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(3.7, 4.1, 7, 12),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  band.position.y = 12;
  tower.add(band);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 5, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd98a }),
  );
  lampRoom.position.y = 32.5;
  tower.add(lampRoom);
  tower.position.set(lx, terrainHeight(lx, lz), lz);
  scene.add(tower);
  scatterForest(scene);
}

function buildSky(scene) {
  // Gradient dome: deep blue-violet up top, molten orange at the horizon.
  const skyGeo = new THREE.SphereGeometry(9000, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2c3a63) },
      mid: { value: new THREE.Color(0xb45a78) },
      low: { value: new THREE.Color(0xff9a3c) },
    },
    vertexShader: [
      'varying vec3 vPos;',
      'void main() {',
      '  vPos = position;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 top; uniform vec3 mid; uniform vec3 low;',
      'varying vec3 vPos;',
      'void main() {',
      '  float t = normalize(vPos).y;',
      '  vec3 c = t > 0.16 ? mix(mid, top, smoothstep(0.16, 0.65, t))',
      '                    : mix(low, mid, smoothstep(-0.04, 0.16, t));',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  // The sun itself: a bright disc with a soft halo, low in the west.
  const sunDir = new THREE.Vector3(-0.62, 0.16, -0.42).normalize();
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(260, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  sun.position.copy(sunDir).multiplyScalar(8600);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  const haloTex = makeCanvasTexture((g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,190,110,0.85)');
    grad.addColorStop(1, 'rgba(255,150,70,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }, 256, 256);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false }),
  );
  halo.scale.set(2600, 2600, 1);
  halo.position.copy(sunDir).multiplyScalar(8400);
  scene.add(halo);
  return sunDir;
}

function buildClouds(scene) {
  const tex = makeCanvasTexture((g, w, h) => {
    const puffs = [[90, 70, 46], [150, 60, 58], [210, 72, 44], [128, 84, 52]];
    for (const puff of puffs) {
      const grad = g.createRadialGradient(puff[0], puff[1], 4, puff[0], puff[1], puff[2]);
      grad.addColorStop(0, 'rgba(255,225,200,0.55)');
      grad.addColorStop(1, 'rgba(255,200,170,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }
  }, 300, 140);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 });
  const clouds = new THREE.Group();
  let seed = 97;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 42; i++) {
    const c = new THREE.Sprite(mat);
    c.position.set(-4500 + rand() * 9000, 480 + rand() * 420, -4500 + rand() * 9000);
    const w = 500 + rand() * 800;
    c.scale.set(w, w * 0.36, 1);
    clouds.add(c);
  }
  scene.add(clouds);
  return clouds;
}

// Builds the whole world into the scene and returns the animated bits.
export function buildWorld(scene) {
  scene.fog = new THREE.Fog(0xe8905a, 900, 8200);
  const sunDir = buildSky(scene);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 1.35);
  sunLight.position.copy(sunDir).multiplyScalar(3000);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x8a7bb8, 0x4a3a30, 0.55));
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.25);
  fill.position.set(1500, 900, 2200);
  scene.add(fill);
  buildGround(scene);
  buildSea(scene);
  buildRunway(scene);
  buildCity(scene);
  buildLandmarks(scene);
  const clouds = buildClouds(scene);
  return { clouds, sunDirection: sunDir };
}
