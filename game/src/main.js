// Merpati Nusantara — game loop, flight model, collisions and states.
// States: title -> playing <-> paused, playing -> crashed | complete.
// The plane starts on the airstrip; the sortie is 8 rings, then land.

const Game = {
  state: 'title',       // title | playing | paused | crashed | complete
  pos: null,            // THREE.Vector3, plane position (metres)
  heading: 0,           // radians, clockwise from north
  pitch: 0,             // radians, positive nose-up
  roll: 0,              // radians, positive banking right
  speed: 0,             // m/s
  throttle: 0,          // 0..1
  fuel: CFG.fuelMax,
  ringsHit: 0,
  score: 0,
  time: 0,
  landings: 0,
  nextRingIndex: 0,
  grounded: true,       // on the runway, rolling (not yet airborne)
  stalled: false,
  engineOut: false,
  shotMode: false,      // true when a ?shot= setup is active (frozen scene)
  world: null,
  aircraft: null,
  camera: null,
  renderer: null,
  scene: null,
  clock: null,
};

function forwardVector(heading, pitch) {
  return new THREE.Vector3(
    Math.sin(heading) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(heading) * Math.cos(pitch)
  );
}

// Put the plane back on the airstrip, ready for a new sortie.
function resetSortie() {
  const g = Game;
  g.pos.set(-110, CFG.runway.height + 1.2, 0);
  g.heading = (CFG.runway.headingDeg * Math.PI) / 180;
  g.pitch = 0;
  g.roll = 0;
  g.speed = 0;
  g.throttle = 0;
  g.fuel = CFG.fuelMax;
  g.ringsHit = 0;
  g.score = 0;
  g.time = 0;
  g.landings = 0;
  g.nextRingIndex = 0;
  g.grounded = true;
  g.stalled = false;
  g.engineOut = false;
  for (let i = 0; i < CFG.ringCount; i++) g.world.setRingState(i, 'idle');
  g.world.setRingState(0, 'next');
  g.aircraft.setAttitude(g.heading, g.pitch, g.roll);
  g.aircraft.group.position.copy(g.pos);
  HUD.warn('');
}

function startSortie() {
  AudioSys.init();
  resetSortie();
  Game.state = 'playing';
  HUD.showOverlay('none');
}

function pauseGame() {
  if (Game.state !== 'playing') return;
  Game.state = 'paused';
  HUD.showOverlay('pause');
}

function resumeGame() {
  if (Game.state !== 'paused') return;
  Game.state = 'playing';
  HUD.showOverlay('none');
}

function crashGame(cause) {
  if (Game.state !== 'playing') return;
  Game.state = 'crashed';
  AudioSys.thud(true);
  AudioSys.update(0, 0, false);
  HUD.showCrash(cause);
}

function completeSortie() {
  if (Game.state !== 'playing') return;
  const timeBonus = Math.max(0, Math.round((CFG.parTimeSec - Game.time) * CFG.timeBonusRate));
  Game.score += timeBonus;
  Game.state = 'complete';
  AudioSys.thud(false);
  AudioSys.update(0, 0, false);
  HUD.showComplete({
    score: Game.score,
    ringsHit: Game.ringsHit,
    time: Game.time,
    landings: Game.landings,
  });
}

// Throttle lever: Shift up, Ctrl down. Runs on the ground too, or the
// plane could never spool up to take off.
function updateThrottle(dt) {
  const g = Game;
  if (Input.held('ShiftLeft') || Input.held('ShiftRight')) {
    g.throttle = Math.min(1, g.throttle + dt * 0.5);
  }
  if (Input.held('ControlLeft') || Input.held('ControlRight')) {
    g.throttle = Math.max(0, g.throttle - dt * 0.5);
  }
  if (g.engineOut) g.throttle = 0;
}

// One step of the arcade flight model.
function stepFlight(dt) {
  const g = Game;
  const input = Input;

  // Stick: pitch and roll chase the stick, then ease back to level.
  const pitchIn = input.pitchAxis();
  const rollIn = input.rollAxis();
  const pitchTarget = pitchIn * CFG.maxPitch;
  const rollTarget = rollIn * CFG.maxRoll;
  const ease = 1 - Math.exp(-CFG.autoLevel * dt);
  g.pitch += (pitchTarget - g.pitch) * (pitchIn !== 0 ? 1 - Math.exp(-4 * dt) : ease);
  g.roll += (rollTarget - g.roll) * (rollIn !== 0 ? 1 - Math.exp(-4 * dt) : ease);

  // Banked turn: heading follows the bank, weaker at low speed.
  const speedFactor = Math.max(0.25, Math.min(1.2, g.speed / CFG.cruiseSpeed));
  g.heading += g.roll * CFG.turnRate * speedFactor * dt;

  // Speed chases the throttle target; turns and climbs bleed it off.
  const targetSpeed = g.throttle * CFG.maxSpeed;
  g.speed += (targetSpeed - g.speed) * CFG.accel * dt;
  g.speed -= Math.abs(g.roll) * CFG.turnBleed * (g.speed / CFG.maxSpeed) * dt;
  if (g.pitch > 0) g.speed -= g.pitch * CFG.climbBleed * dt;
  if (g.pitch < 0) g.speed += -g.pitch * CFG.climbBleed * 0.5 * dt;
  if (g.speed < 0) g.speed = 0;

  // Stall: below the minimum speed the nose drops on its own.
  g.stalled = !g.grounded && g.speed < CFG.stallSpeed;
  if (g.stalled) {
    g.pitch -= 0.9 * dt;
    if (g.pitch < -CFG.maxPitch) g.pitch = -CFG.maxPitch;
  }

  // Fuel drains with throttle; empty means gliding only.
  g.fuel -= g.throttle * CFG.fuelDrain * dt;
  if (g.fuel <= 0) {
    g.fuel = 0;
    g.engineOut = true;
  }

  // Move along the forward vector.
  const fwd = forwardVector(g.heading, g.pitch);
  g.pos.addScaledVector(fwd, g.speed * dt);

  // --- collisions ------------------------------------------------------
  const groundY = g.world.heightAt(g.pos.x, g.pos.z);
  if (g.pos.y <= CFG.seaLevel + 0.8) {
    crashGame('Ditched in the sea — the Merpati is a plane, not a boat.');
    return;
  }
  // Touchdown: the strip catches the plane a little early (within 2 m
  // of the ground) so a low, slow, level pass settles onto it instead
  // of skimming forever just above the concrete.
  const stripTouch = g.world.isOnRunway(g.pos.x, g.pos.z) && g.pos.y <= groundY + 2.0;
  if (stripTouch || g.pos.y <= groundY + 1.2) {
    const onStrip = g.world.isOnRunway(g.pos.x, g.pos.z);
    const descent = -fwd.y * g.speed;
    // A forgiving touchdown window: a light descent under 7 m/s, a
    // speed the strip can absorb, and wings near level. Holding the
    // nose hard down is a dive, not a landing, and still crashes.
    const gentle = descent < 7 && g.speed < 42 && Math.abs(g.pitch) < 0.35 && Math.abs(g.roll) < 0.4;
    if (onStrip && gentle) {
      landOnRunway();
      return;
    }
    if (onStrip && g.grounded) {
      // Rolling along the strip: stay on it.
      g.pos.y = CFG.runway.height + 1.2;
      return;
    }
    if (!onStrip) {
      crashGame(groundY > 2 ? 'Hit the terrain — the islands are not soft.' : 'Hit the ground.');
      return;
    }
    // On the strip but too fast or too steep to land: keep flying
    // (a low pass) instead of crashing for a near miss.
    if (g.pos.y <= groundY + 1.2) {
      crashGame('Hit the runway too hard — flare gently next time.');
      return;
    }
  }

  // --- rings ------------------------------------------------------------
  if (g.nextRingIndex < CFG.ringCount) {
    const ring = g.world.rings[g.nextRingIndex];
    const d = g.pos.distanceTo(ring.pos);
    if (d < CFG.ringCatch) {
      g.world.setRingState(g.nextRingIndex, 'done');
      g.ringsHit++;
      g.score += CFG.ringScore;
      g.fuel = Math.min(CFG.fuelMax, g.fuel + CFG.fuelRingBonus);
      AudioSys.chime();
      HUD.message('Ring ' + g.ringsHit + '/' + CFG.ringCount + '!  +100  ·  Fuel +' + CFG.fuelRingBonus);
      g.nextRingIndex++;
      if (g.nextRingIndex < CFG.ringCount) {
        g.world.setRingState(g.nextRingIndex, 'next');
      } else {
        HUD.message('All rings! Now land on the runway.', 2600);
      }
    }
  }

  // --- warnings ---------------------------------------------------------
  if (g.engineOut) {
    HUD.warn('ENGINE OUT — glide to the runway!');
  } else if (g.stalled) {
    HUD.warn('STALL — nose down, add throttle!');
  } else if (g.fuel < 25) {
    HUD.warn('LOW FUEL — fly through a ring to refuel');
  } else {
    HUD.warn('');
  }
}

// Touchdown on the airstrip.
function landOnRunway() {
  const g = Game;
  g.landings++;
  g.fuel = CFG.fuelLandingRefill;
  g.engineOut = false;
  g.grounded = true;
  g.speed = 0;
  g.throttle = 0;
  g.pitch = 0;
  g.roll = 0;
  g.pos.y = CFG.runway.height + 1.2;
  AudioSys.thud(false);
  if (g.ringsHit >= CFG.ringCount) {
    g.score += CFG.landingBonus;
    completeSortie();
  } else {
    HUD.message('Landed safely — refuelled. Throttle up to take off again.', 2600);
  }
}

// Chase camera: behind the plane, a little above, easing after it.
// Mouse drag orbits the view slightly without steering the plane.
function updateCamera(dt) {
  const g = Game;
  const hFwd = new THREE.Vector3(Math.sin(g.heading), 0, -Math.cos(g.heading));
  // Orbit the camera around the plane by the mouse drag.
  const orbit = new THREE.Vector3().copy(hFwd).applyAxisAngle(new THREE.Vector3(0, 1, 0), Input.orbitYaw);
  const desired = new THREE.Vector3()
    .copy(g.pos)
    .addScaledVector(orbit, -CFG.camDistance)
    .add(new THREE.Vector3(0, CFG.camHeight + Input.orbitPitch * 14, 0));
  const k = 1 - Math.exp(-CFG.camLerp * dt);
  g.camera.position.lerp(desired, k);
  const look = new THREE.Vector3()
    .copy(g.pos)
    .addScaledVector(forwardVector(g.heading, g.pitch), 14)
    .add(new THREE.Vector3(0, 1.2, 0));
  g.camera.lookAt(look);
}

// One rendered frame.
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Game.clock.getDelta());
  const g = Game;

  if (g.state === 'playing') {
    g.time += dt;
    updateThrottle(dt);
    // Take-off: once fast enough with the nose up, leave the ground.
    if (g.grounded) {
      if (g.throttle > 0.15) {
        g.speed += (g.throttle * CFG.maxSpeed - g.speed) * CFG.accel * dt;
      }
      g.pos.addScaledVector(forwardVector(g.heading, 0), g.speed * dt);
      g.pos.y = CFG.runway.height + 1.2;
      if (g.speed > 32 && Input.pitchAxis() > 0) {
        g.grounded = false;
        g.pitch = 0.12;
      }
      g.fuel -= g.throttle * CFG.fuelDrain * dt;
      if (g.fuel < 0) g.fuel = 0;
    } else {
      stepFlight(dt);
    }
    if (g.state === 'playing') {
      // Edge-triggered keys.
      if (Input.pressed('KeyP')) pauseGame();
      if (Input.pressed('KeyR')) startSortie();
      if (Input.pressed('KeyM')) AudioSys.toggleMute();
    }
  } else if (g.state === 'paused') {
    // P resumes from pause too (the playing branch cannot see the key
    // once the game is paused).
    if (Input.pressed('KeyP')) resumeGame();
    if (Input.pressed('KeyR')) startSortie();
    if (Input.pressed('KeyM')) AudioSys.toggleMute();
  } else if (g.state === 'title' && !g.shotMode) {
    // Gentle orbit around the parked plane while the title shows.
    // (Frozen in screenshot mode so the cover shot is deterministic.)
    const t = performance.now() * 0.001;
    const cx = -110 + Math.sin(t * 0.12) * 34;
    const cz = 26 + Math.cos(t * 0.12) * 20;
    g.camera.position.lerp(new THREE.Vector3(cx, CFG.runway.height + 12, cz), 0.04);
    g.camera.lookAt(g.pos.x, g.pos.y + 1, g.pos.z);
  }

  // The aircraft, the HUD and the sound follow the state every frame,
  // even on the title screen so the instruments are lit for the cover shot.
  g.aircraft.setAttitude(g.heading, g.pitch, g.roll);
  g.aircraft.group.position.copy(g.pos);
  g.aircraft.spinProp(dt, g.state === 'playing' ? g.throttle : 0.12);
  // In screenshot mode the camera stays where the shot put it;
  // otherwise the chase camera would re-centre the plane behind the card.
  if (g.state !== 'title' && !g.shotMode) updateCamera(dt);
  const nextRing = g.nextRingIndex < CFG.ringCount ? g.world.rings[g.nextRingIndex] : null;
  HUD.update({
    pos: g.pos,
    heading: g.heading,
    speed: g.speed,
    throttle: g.throttle,
    fuel: g.fuel,
    score: g.score,
    ringsHit: g.ringsHit,
    time: g.time,
    nextRing,
  });
  AudioSys.update(g.throttle, g.speed, g.state === 'playing' && !g.grounded);

  g.world.update(dt, performance.now() * 0.001);
  g.renderer.render(g.scene, g.camera);
}

function initGame() {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
  camera.position.set(-150, 30, 40);

  // Sun and sky light.
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
  sun.position.set(500, 800, 300);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9e8, 0.75));

  const world = buildWorld(scene, 1);
  const aircraft = buildAircraft(scene);

  Game.renderer = renderer;
  Game.scene = scene;
  Game.camera = camera;
  Game.world = world;
  Game.aircraft = aircraft;
  Game.pos = new THREE.Vector3(-110, CFG.runway.height + 1.2, 0);
  Game.clock = new THREE.Clock();
  Game.heading = (CFG.runway.headingDeg * Math.PI) / 180;

  Input.init(canvas);
  HUD.init();
  resetSortie();

  // Buttons on the overlays.
  document.getElementById('btnStart').addEventListener('click', startSortie);
  document.getElementById('btnResume').addEventListener('click', resumeGame);
  document.getElementById('btnRetry').addEventListener('click', startSortie);
  document.getElementById('btnAgain').addEventListener('click', startSortie);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Screenshot hooks (?shot=start|play|end) are defined in shots.js.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot && typeof applyShot === 'function') {
    applyShot(shot);
  } else {
    HUD.showOverlay('title');
  }

  Game.clock.start();
  frame();
}

document.addEventListener('DOMContentLoaded', initGame);
