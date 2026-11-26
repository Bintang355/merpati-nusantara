// Merpati Nusantara — deterministic screenshot setups.
// Read from the URL query: ?shot=start|play|end&seed=1
// Each setup places the plane, the camera and the HUD so the scene
// renders identically with no user input. The game loop keeps running
// (prop spinning, clouds drifting) but the flight model is frozen.

function applyShot(mode) {
  const g = Game;
  g.shotMode = true;
  const seed = new URLSearchParams(window.location.search).get('seed') || '1';
  void seed; // the world is built from seed 1 already; the param pins it

  if (mode === 'start') {
    // Parked on the runway, title overlay up, instruments lit.
    resetSortie();
    g.state = 'title';
    // A fixed three-quarter view: the plane, the strip and the islands
    // behind it, instead of the slow title orbit. The look target is
    // offset to the screen-right so the plane sits in the left third,
    // clear of the centred title card.
    g.camera.position.set(-148, CFG.runway.height + 16, 42);
    g.camera.lookAt(-89, g.pos.y + 1, 25);
    HUD.showOverlay('title');
    HUD.warn('');
  } else if (mode === 'play') {
    // Mid-flight chase view, passing the second ring, HUD lit.
    resetSortie();
    g.state = 'playing';
    // Place the plane on the approach to ring 2, already airborne.
    const ring = g.world.rings[1];
    const prev = g.world.rings[0];
    const dx = ring.pos.x - prev.pos.x;
    const dz = ring.pos.z - prev.pos.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    g.pos.set(ring.pos.x - ux * 130, ring.pos.y - 6, ring.pos.z - uz * 130);
    g.heading = Math.atan2(ux, -uz);
    g.pitch = 0.05;
    g.roll = 0.12;
    g.speed = 58;
    g.throttle = 0.62;
    g.fuel = 82;
    g.grounded = false;
    g.ringsHit = 1;
    g.score = 100;
    g.time = 47;
    g.nextRingIndex = 1;
    g.world.setRingState(0, 'done');
    g.world.setRingState(1, 'next');
    // Freeze the flight model for the shot: the loop renders but the
    // plane holds this pose. (state 'paused' skips stepFlight.)
    g.state = 'paused';
    HUD.showOverlay('none');
    HUD.warn('');
    // Chase camera behind the plane, ring ahead in frame.
    const hFwd = new THREE.Vector3(Math.sin(g.heading), 0, -Math.cos(g.heading));
    g.camera.position.copy(g.pos).addScaledVector(hFwd, -CFG.camDistance).add(new THREE.Vector3(0, CFG.camHeight + 2, 0));
    g.camera.lookAt(ring.pos.x, ring.pos.y, ring.pos.z);
    HUD.message('Ring 1/8!  +100  ·  Fuel +14', 60000);
  } else if (mode === 'end') {
    // Mission complete over the runway: plane parked, results on screen.
    resetSortie();
    g.state = 'complete';
    g.ringsHit = CFG.ringCount;
    g.score = 100 * CFG.ringCount + CFG.landingBonus + 214;
    g.time = 213;
    g.landings = 1;
    g.fuel = 64;
    g.nextRingIndex = CFG.ringCount;
    for (let i = 0; i < CFG.ringCount; i++) g.world.setRingState(i, 'done');
    // Same framing as the cover shot (the plane is parked in the same
    // spot): the plane in the left third, the runway running away to
    // the right of the results card.
    g.camera.position.set(-148, CFG.runway.height + 16, 42);
    g.camera.lookAt(-89, g.pos.y + 1, 25);
    HUD.showComplete({
      score: g.score,
      ringsHit: g.ringsHit,
      time: g.time,
      landings: g.landings,
    });
    HUD.warn('');
  }
}
