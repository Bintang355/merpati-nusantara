// Merpati Nusantara — the HUD: every instrument and readout on the
// page is updated here, once per frame, from the flight state.

const HUD = {
  el: {},

  init() {
    const ids = [
      'alt', 'speed', 'heading', 'headingLetter', 'throttle', 'throttleBar',
      'fuel', 'fuelBar', 'fuelWrap', 'score', 'rings', 'time',
      'ringArrow', 'ringDist', 'ringLabel', 'warn', 'message',
      'overlayTitle', 'overlayPause', 'overlayCrash',
      'overlayComplete', 'crashCause', 'finalScore', 'finalRings',
      'finalTime', 'finalLandings',
    ];
    for (const id of ids) HUD.el[id] = document.getElementById(id);
  },

  // Compass letter for a heading in degrees.
  letter(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  },

  // Update the flight instruments from the plane state.
  update(state) {
    const el = HUD.el;
    const altM = Math.max(0, Math.round(state.pos.y));
    el.alt.textContent = altM + ' m';
    el.speed.textContent = Math.round(state.speed * 3.6) + ' km/h';
    const deg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
    el.heading.textContent = String(Math.round(deg)).padStart(3, '0') + '°';
    el.headingLetter.textContent = HUD.letter(deg);
    el.throttle.textContent = Math.round(state.throttle * 100) + '%';
    el.throttleBar.style.width = Math.round(state.throttle * 100) + '%';
    el.fuel.textContent = Math.round(state.fuel) + '%';
    el.fuelBar.style.width = Math.max(0, Math.min(100, state.fuel)) + '%';
    el.fuelWrap.classList.toggle('low', state.fuel < 25);
    el.score.textContent = state.score;
    el.rings.textContent = state.ringsHit + '/' + CFG.ringCount;
    const t = Math.floor(state.time);
    el.time.textContent =
      String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');

    // Compass arrow to the next ring: rotate a needle by the bearing
    // relative to the current heading, and show the distance.
    if (state.nextRing) {
      const dx = state.nextRing.pos.x - state.pos.x;
      const dz = state.nextRing.pos.z - state.pos.z;
      const bearing = Math.atan2(dx, -dz);
      let rel = bearing - state.heading;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      el.ringArrow.style.transform = 'rotate(' + (rel * 180) / Math.PI + 'deg)';
      const dist = Math.round(Math.sqrt(dx * dx + dz * dz + Math.pow(state.nextRing.pos.y - state.pos.y, 2)));
      el.ringDist.textContent = dist + ' m';
      el.ringLabel.textContent = 'RING ' + (state.ringsHit + 1);
    } else {
      el.ringLabel.textContent = 'LAND';
      el.ringDist.textContent = 'runway';
      el.ringArrow.style.transform = 'rotate(0deg)';
    }
  },

  // Show a warning line (stall, low fuel, engine out) or clear it.
  warn(text) {
    HUD.el.warn.textContent = text || '';
    HUD.el.warn.classList.toggle('show', !!text);
  },

  // A short-lived centre message ("Ring 3/8! +100", "Fuel +14").
  message(text, ms) {
    const el = HUD.el.message;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(HUD._msgTimer);
    HUD._msgTimer = setTimeout(() => el.classList.remove('show'), ms || 1800);
  },

  // Show exactly one overlay; 'none' hides them all.
  showOverlay(name) {
    const map = {
      title: 'overlayTitle',
      pause: 'overlayPause',
      crash: 'overlayCrash',
      complete: 'overlayComplete',
    };
    for (const key of Object.keys(map)) {
      HUD.el[map[key]].classList.toggle('hidden', key !== name);
    }
  },

  // Fill the crash screen with the cause of the crash.
  showCrash(cause) {
    HUD.el.crashCause.textContent = cause;
    HUD.showOverlay('crash');
  },

  // Fill the mission-complete screen with the sortie results.
  showComplete(results) {
    HUD.el.finalScore.textContent = results.score;
    HUD.el.finalRings.textContent = results.ringsHit + ' / ' + CFG.ringCount;
    const t = Math.floor(results.time);
    HUD.el.finalTime.textContent =
      String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    HUD.el.finalLandings.textContent = results.landings;
    HUD.showOverlay('complete');
  },
};
