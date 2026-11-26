// Merpati Nusantara — keyboard and mouse state.
// Keys are read as a held set; the flight model polls it every frame.
// Mouse drag orbits the chase camera a little; it never steers the plane.

const Input = {
  keys: {},            // code -> true while held
  orbitYaw: 0,         // mouse-drag orbit offset, radians (yaw)
  orbitPitch: 0,       // mouse-drag orbit offset, radians (pitch)
  dragging: false,
  _lastX: 0,
  _lastY: 0,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      // Keep the page from scrolling on arrows and space.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      Input.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      Input.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      Input.keys = {};
    });

    canvas.addEventListener('mousedown', (e) => {
      Input.dragging = true;
      Input._lastX = e.clientX;
      Input._lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      Input.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!Input.dragging) return;
      const dx = e.clientX - Input._lastX;
      const dy = e.clientY - Input._lastY;
      Input._lastX = e.clientX;
      Input._lastY = e.clientY;
      Input.orbitYaw = Math.max(-CFG.camOrbitMax, Math.min(CFG.camOrbitMax, Input.orbitYaw - dx * 0.004));
      Input.orbitPitch = Math.max(-0.3, Math.min(0.35, Input.orbitPitch + dy * 0.003));
    });
  },

  held(code) {
    return !!Input.keys[code];
  },

  // Pitch stick: +1 pulls the nose up, -1 pushes it down.
  pitchAxis() {
    let v = 0;
    if (Input.held('ArrowUp') || Input.held('KeyW')) v += 1;
    if (Input.held('ArrowDown') || Input.held('KeyS')) v -= 1;
    return v;
  },

  // Roll stick: +1 banks right, -1 banks left.
  rollAxis() {
    let v = 0;
    if (Input.held('ArrowRight') || Input.held('KeyD')) v += 1;
    if (Input.held('ArrowLeft') || Input.held('KeyA')) v -= 1;
    return v;
  },

  // True only on the frame the key went down (edge trigger).
  _pressed: {},
  pressed(code) {
    const held = !!Input.keys[code];
    const was = !!Input._pressed[code];
    Input._pressed[code] = held;
    return held && !was;
  },
};
