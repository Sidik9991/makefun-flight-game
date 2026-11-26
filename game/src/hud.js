// hud.js — the panel: everything the pilot reads, drawn fresh each frame —
// a lit instrument cluster (artificial horizon, airspeed and altimeter
// dials, compass ribbon), digital ALT / SPD / HDG / V-S readouts, fuel /
// hull / throttle bars, the mission card with the ring count, the
// objective pointer, stall warning, banners and toasts.

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function createHud(root) {
  root.innerHTML = `
    <div id="hud-top-left" class="hud-card">
      <div id="hud-mission-name">MERIDIAN RUN</div>
      <div id="hud-objective">—</div>
      <div id="hud-rings">RINGS 0 / 0</div>
    </div>
    <div id="hud-top-right" class="hud-card">
      <div id="hud-clock">00:00</div>
      <div id="hud-score">MAIL 0</div>
    </div>
    <div id="hud-banner"></div>
    <div id="hud-toast"></div>
    <div id="hud-bottom">
      <canvas id="hud-instruments" width="460" height="150"></canvas>
      <div id="hud-readouts">
        <div class="readout"><span class="ro-label">ALT</span><span id="ro-alt">0</span><span class="ro-unit">m</span></div>
        <div class="readout"><span class="ro-label">SPD</span><span id="ro-spd">0</span><span class="ro-unit">kt</span></div>
        <div class="readout"><span class="ro-label">HDG</span><span id="ro-hdg">000</span><span class="ro-unit">°</span></div>
        <div class="readout"><span class="ro-label">V/S</span><span id="ro-vs">+0.0</span><span class="ro-unit">m/s</span></div>
      </div>
      <div id="hud-bars">
        <div class="bar-row"><span class="bar-label">FUEL</span><div class="bar"><div id="bar-fuel"></div></div></div>
        <div class="bar-row"><span class="bar-label">HULL</span><div class="bar"><div id="bar-hull"></div></div></div>
        <div class="bar-row"><span class="bar-label">THR</span><div class="bar"><div id="bar-thr"></div></div></div>
      </div>
    </div>
    <div id="hud-pointer"><div id="hud-pointer-arrow">➤</div><div id="hud-pointer-dist"></div></div>
    <div id="hud-stall">STALL</div>`;

  const el = (id) => root.querySelector('#' + id);
  const instruments = el('hud-instruments').getContext('2d');
  let bannerTimer = 0;
  let toastTimer = 0;

  function banner(text, seconds) {
    const b = el('hud-banner');
    b.textContent = text;
    b.style.opacity = '1';
    bannerTimer = seconds || 2.6;
  }

  function toast(text, seconds) {
    const t = el('hud-toast');
    t.textContent = text;
    t.style.opacity = '1';
    toastTimer = seconds || 2.2;
  }

  function drawDial(g, cx, cy, r, value, max, label, unit, dangerAt) {
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = 'rgba(10,14,22,0.88)';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#ffb36b';
    g.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const inner = r - 7;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      g.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      g.strokeStyle = dangerAt !== null && i / 10 >= dangerAt ? '#ff5a4a' : '#e8e4da';
      g.lineWidth = 1.4;
      g.stroke();
    }
    const a = Math.PI * 0.75 + Math.min(1, Math.max(0, value / max)) * Math.PI * 1.5;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * (r - 9), cy + Math.sin(a) * (r - 9));
    g.strokeStyle = '#ffd98a';
    g.lineWidth = 2.6;
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 3, 0, Math.PI * 2);
    g.fillStyle = '#ffd98a';
    g.fill();
    g.fillStyle = '#ffb36b';
    g.font = 'bold 10px sans-serif';
    g.textAlign = 'center';
    g.fillText(label, cx, cy + r * 0.52);
    g.fillStyle = '#f5efe2';
    g.font = 'bold 12px monospace';
    g.fillText(String(Math.round(value)) + unit, cx, cy + r * 0.78);
    g.restore();
  }

  function drawHorizon(g, cx, cy, r, pitch, roll) {
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-roll);
    const lift = Math.max(-r, Math.min(r, pitch * r * 1.6));
    g.fillStyle = '#3a6ea8';
    g.fillRect(-r, -r + lift, r * 2, r * 2);
    g.fillStyle = '#8a5a33';
    g.fillRect(-r, lift, r * 2, r * 2);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1;
    for (const off of [-0.5, -0.25, 0.25, 0.5]) {
      g.beginPath();
      g.moveTo(-r * 0.3, lift + off * r);
      g.lineTo(r * 0.3, lift + off * r);
      g.stroke();
    }
    g.restore();
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.lineWidth = 2;
    g.strokeStyle = '#ffb36b';
    g.stroke();
    // Fixed aircraft symbol.
    g.strokeStyle = '#ffd98a';
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(cx - r * 0.55, cy);
    g.lineTo(cx - r * 0.18, cy);
    g.lineTo(cx, cy + r * 0.14);
    g.lineTo(cx + r * 0.18, cy);
    g.lineTo(cx + r * 0.55, cy);
    g.stroke();
    g.fillStyle = '#ffb36b';
    g.font = 'bold 10px sans-serif';
    g.textAlign = 'center';
    g.fillText('ATT', cx, cy + r + 13);
    g.restore();
  }

  function drawCompass(g, cx, cy, w, headingDeg) {
    // A ribbon showing 90 degrees of compass at a time: cardinal letters at
    // the 45s, two-digit tens at the 15s, plain ticks between. Labels are
    // bounds-checked against the box instead of clipped, so nothing smears.
    g.save();
    g.fillStyle = 'rgba(10,14,22,0.88)';
    g.fillRect(cx - w / 2, cy - 13, w, 26);
    g.strokeStyle = '#ffb36b';
    g.lineWidth = 1.6;
    g.strokeRect(cx - w / 2, cy - 13, w, 26);
    g.font = 'bold 11px monospace';
    g.textAlign = 'center';
    const base = Math.round(headingDeg / 5) * 5;
    for (let d = -50; d <= 50; d += 5) {
      const deg = (((base + d) % 360) + 360) % 360;
      const x = cx + ((headingDeg - base + d) / 90) * w;
      if (x < cx - w / 2 + 9 || x > cx + w / 2 - 9) continue;
      if (deg % 45 === 0) {
        g.fillStyle = '#ffd98a';
        g.fillText(COMPASS_POINTS[deg / 45], x, cy + 4);
      } else if (deg % 30 === 0) {
        // Compass tens are only whole at the 30s: 03, 06, 12 ... 33.
        g.fillStyle = '#e8e4da';
        g.fillText(String(deg / 10).padStart(2, '0'), x, cy + 4);
      } else {
        g.fillStyle = 'rgba(232,228,218,0.55)';
        g.fillRect(x - 0.7, cy - 5, 1.4, 5);
      }
    }
    g.restore();
    g.fillStyle = '#ff5a4a';
    g.beginPath();
    g.moveTo(cx - 5, cy - 19);
    g.lineTo(cx + 5, cy - 19);
    g.lineTo(cx, cy - 12);
    g.closePath();
    g.fill();
  }

  return {
    banner,
    toast,

    setMission(name, brief) {
      el('hud-mission-name').textContent = name.toUpperCase();
      el('hud-objective').textContent = brief;
    },

    // state: everything the panel shows, refreshed once a frame.
    update(dt, s) {
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el('hud-banner').style.opacity = '0';
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) el('hud-toast').style.opacity = '0';
      }
      el('ro-alt').textContent = String(Math.max(0, Math.round(s.altitude)));
      el('ro-spd').textContent = String(Math.round(s.speed * 1.944)); // m/s -> knots
      el('ro-hdg').textContent = String(Math.round(s.headingDeg) % 360).padStart(3, '0');
      el('ro-vs').textContent = (s.verticalSpeed >= 0 ? '+' : '') + s.verticalSpeed.toFixed(1);
      el('hud-rings').textContent = `RINGS ${s.ringsFlown} / ${s.ringsTotal}`;
      const mm = String(Math.floor(s.time / 60)).padStart(2, '0');
      const ss = String(Math.floor(s.time % 60)).padStart(2, '0');
      el('hud-clock').textContent = `${mm}:${ss}`;
      el('hud-score').textContent = `MAIL ${s.score}`;
      el('bar-fuel').style.width = `${Math.max(0, s.fuel)}%`;
      el('bar-fuel').style.background = s.fuel < 22 ? '#ff5a4a' : '#ffc46b';
      el('bar-hull').style.width = `${Math.max(0, 100 - s.damage)}%`;
      el('bar-hull').style.background = s.damage > 55 ? '#ff5a4a' : '#7ddc7d';
      el('bar-thr').style.width = `${Math.round(s.throttle * 100)}%`;
      el('hud-stall').style.opacity = s.stalling ? '1' : '0';
      // Pointer to the next objective, projected around the screen centre.
      const pointer = el('hud-pointer');
      if (s.targetBearing !== null && s.targetBearing !== undefined) {
        pointer.style.display = 'block';
        const rel = ((s.targetBearing - s.headingDeg + 540) % 360) - 180;
        const rad = (rel * Math.PI) / 180;
        const radius = 120;
        pointer.style.transform =
          `translate(${Math.sin(rad) * radius}px, ${-Math.cos(rad) * radius * 0.6}px)`;
        el('hud-pointer-arrow').style.transform = `rotate(${rel}deg)`;
        el('hud-pointer-dist').textContent = s.targetDist >= 1000
          ? (s.targetDist / 1000).toFixed(1) + ' km'
          : Math.round(s.targetDist) + ' m';
      } else {
        pointer.style.display = 'none';
      }
      // Instruments.
      const g = instruments;
      g.clearRect(0, 0, 460, 150);
      drawHorizon(g, 62, 66, 44, s.pitch, s.roll);
      drawDial(g, 168, 66, 44, s.speed * 1.944, 200, 'AIRSPEED', 'kt', null);
      drawDial(g, 274, 66, 44, s.altitude, 600, 'ALTITUDE', 'm', null);
      drawCompass(g, 392, 66, 120, s.headingDeg);
    },
  };
}
