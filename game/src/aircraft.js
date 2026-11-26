// Merpati Nusantara — builds the island-hopper aircraft and owns its
// orientation. The plane is built facing -Z (three.js forward), so a
// group rotation of (pitch, heading, roll) with order 'YXZ' flies it
// along the heading with the nose up or down and the wings banked.

function buildAircraft(scene) {
  const pal = CFG.palette;
  const white = new THREE.MeshLambertMaterial({ color: pal.planeWhite });
  const red = new THREE.MeshLambertMaterial({ color: pal.planeRed });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4ef });

  const plane = new THREE.Group();

  // Fuselage: a tapered cylinder lying along Z, nose at -Z.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 7.2, 10), white);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  plane.add(fuselage);

  // Nose cone in island red.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 10), red);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.6;
  plane.add(nose);

  // Tail cone.
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 8), white);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 4.4;
  plane.add(tailCone);

  // Cockpit canopy: a flattened half-sphere on top of the fuselage.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.position.set(0, 0.55, -1.2);
  canopy.scale.set(1, 0.75, 1.6);
  plane.add(canopy);

  // Main wing: a wide flat box across the fuselage, red tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 1.9), white);
  wing.position.set(0, 0.1, -0.6);
  plane.add(wing);
  const tipGeo = new THREE.BoxGeometry(0.9, 0.3, 1.9);
  for (const x of [-5.35, 5.35]) {
    const tip = new THREE.Mesh(tipGeo, red);
    tip.position.set(x, 0.1, -0.6);
    plane.add(tip);
  }

  // Tailplane and fin.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.2), white);
  tailplane.position.set(0, 0.25, 4.4);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 1.4), red);
  fin.position.set(0, 1.0, 4.4);
  plane.add(fin);

  // Fixed landing gear: two wheels and a tail wheel.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  for (const x of [-1.1, 1.1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), dark);
    strut.position.set(x, -1.0, -0.4);
    plane.add(strut);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -1.55, -0.4);
    plane.add(wheel);
  }

  // Propeller: a hub plus two blades, spun every frame.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), dark);
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.28, 3.4, 0.1);
  const blade = new THREE.Mesh(bladeGeo, dark);
  prop.add(blade);
  const blade2 = new THREE.Mesh(bladeGeo, dark);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  prop.position.set(0, 0, -4.5);
  plane.add(prop);

  // Navigation lights: red left, green right.
  const navGeo = new THREE.SphereGeometry(0.16, 6, 6);
  const navLeft = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  navLeft.position.set(-5.8, 0.1, -0.6);
  plane.add(navLeft);
  const navRight = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0x2aff5a }));
  navRight.position.set(5.8, 0.1, -0.6);
  plane.add(navRight);

  plane.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = false;
  });
  scene.add(plane);

  // Spin the propeller; spin rate follows the throttle.
  function spinProp(dt, throttle) {
    prop.rotation.z += dt * (6 + throttle * 55);
  }

  // Point the plane along a heading/pitch/roll triple.
  // Heading is clockwise from north (0 = north, PI/2 = east); pitch is
  // positive nose-up; roll is positive banking right. The signs below
  // make the mesh's forward (-Z) match the flight model's forward
  // vector (sin h * cos p, sin p, -cos h * cos p).
  function setAttitude(heading, pitch, roll) {
    plane.rotation.order = 'YXZ';
    plane.rotation.y = -heading;
    plane.rotation.x = pitch;
    plane.rotation.z = -roll;
  }

  return { group: plane, spinProp, setAttitude };
}
