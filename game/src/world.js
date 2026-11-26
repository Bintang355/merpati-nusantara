// Merpati Nusantara — builds the archipelago: sea, islands, palms,
// clouds, the airstrip and the ring course. Also owns the height
// function the flight model uses for terrain collision.

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Smooth step from 0 to 1 between edge0 and edge1.
function edgeStep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// One island's contribution: a smooth dome, 1 at the centre, 0 at the rim.
function islandBump(dx, dz, radius, height) {
  const d = Math.sqrt(dx * dx + dz * dz) / radius;
  if (d >= 1) return 0;
  const fall = Math.cos(d * Math.PI * 0.5);
  return height * fall * fall;
}

// Build the world into the scene. Returns the live world object:
//   heightAt(x, z) — terrain height in metres (0 over open sea)
//   isOnRunway(x, z) — true inside the airstrip rectangle
//   runway — { center, headingRad, length, width, height }
//   rings — [{ mesh, pos, index }] in course order
//   setRingState(i, state) — 'next' | 'idle' | 'done'
//   update(dt, time) — clouds drift and the next ring pulses
function buildWorld(scene, seed) {
  const pal = CFG.palette;
  const runway = CFG.runway;
  const runwayHeading = (runway.headingDeg * Math.PI) / 180;

  // --- terrain height -------------------------------------------------
  function landHeight(x, z) {
    let h = islandBump(x, z, CFG.homeRadius, CFG.homeHeight);
    for (let i = 0; i < CFG.islands.length; i++) {
      const isl = CFG.islands[i];
      h += islandBump(x - isl[0], z - isl[1], isl[2], isl[3]);
    }
    // Gentle noise so the slopes are never perfectly smooth.
    const mask = edgeStep(0.5, 8, h);
    h += (valueNoise2D(x * 0.004, z * 0.004, seed) - 0.5) * 7 * mask;
    return h;
  }

  // Flatten the ground under the airstrip to the strip height.
  function heightAt(x, z) {
    const h = landHeight(x, z);
    const dx = Math.max(Math.abs(x) - runway.length / 2, 0);
    const dz = Math.max(Math.abs(z) - runway.width / 2, 0);
    const dist = Math.sqrt(dx * dx + dz * dz);
    const blend = 1 - edgeStep(0, 80, dist);
    return h * (1 - blend) + runway.height * blend;
  }

  function isOnRunway(x, z) {
    return Math.abs(x) <= runway.length / 2 + 4 && Math.abs(z) <= runway.width / 2 + 4;
  }

  // --- sky, sea --------------------------------------------------------
  scene.background = new THREE.Color(pal.sky);
  scene.fog = new THREE.Fog(pal.sky, 900, 5200);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.worldSize, CFG.worldSize),
    new THREE.MeshLambertMaterial({ color: pal.sea, transparent: true, opacity: 0.94 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = CFG.seaLevel;
  scene.add(sea);

  // --- terrain mesh ----------------------------------------------------
  const SEG = 150;
  const terrainGeo = new THREE.PlaneGeometry(CFG.worldSize, CFG.worldSize, SEG, SEG);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(pal.sand);
  const grass = new THREE.Color(pal.grass);
  const grassDark = new THREE.Color(0x3d7f3a);
  const rock = new THREE.Color(pal.rock);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h - 2.5); // sink the base a little so the sea floor stays under water
    // Colour by height with a little noise so the ground reads as terrain.
    const n = valueNoise2D(x * 0.02, z * 0.02, seed + 7);
    if (h < 2.5) {
      tmpColor.copy(sand);
    } else if (h < 16) {
      tmpColor.copy(grass).lerp(grassDark, n * 0.7);
    } else if (h < 32) {
      tmpColor.copy(grass).lerp(rock, edgeStep(16, 32, h));
    } else {
      tmpColor.copy(rock);
    }
    // Darken the sand right at the waterline so the beach reads.
    if (h < 1.2) tmpColor.multiplyScalar(0.92);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true })
  );
  scene.add(terrain);

  // --- palm trees -------------------------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 9, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const crownGeo = new THREE.ConeGeometry(4.6, 3.2, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const rng = makeRng(seed + 101);
  for (let i = 0; i < CFG.palms.length; i++) {
    const spec = CFG.palms[i];
    const isl = spec[0] === 0 ? [0, 0] : CFG.islands[spec[0] - 1];
    const px = isl[0] + Math.cos(spec[1]) * spec[2];
    const pz = isl[1] + Math.sin(spec[1]) * spec[2];
    const py = heightAt(px, pz);
    if (py < 2) continue; // keep palms out of the water
    const lean = (rng() - 0.5) * 0.16;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, py + 4.5, pz);
    trunk.rotation.z = lean;
    scene.add(trunk);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(px + lean * -4, py + 10.2, pz);
    crown.scale.y = 0.55;
    crown.rotation.y = rng() * Math.PI;
    scene.add(crown);
  }

  // --- clouds -----------------------------------------------------------
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: pal.cloud, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 14; i++) {
    const group = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 2);
    for (let j = 0; j < puffs; j++) {
      const r = 14 + rng() * 16;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set((j - puffs / 2) * 20 + rng() * 8, rng() * 5, rng() * 10 - 5);
      puff.scale.y = 0.45;
      group.add(puff);
    }
    group.position.set((rng() - 0.5) * 4200, 190 + rng() * 130, (rng() - 0.5) * 4200);
    // Each cloud remembers its own cruising height and bob phase so
    // the update loop can make it drift up and down gently.
    group.userData.baseY = group.position.y;
    group.userData.phase = rng() * Math.PI * 2;
    scene.add(group);
    clouds.push(group);
  }

  // --- runway -----------------------------------------------------------
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(runway.length, 0.7, runway.width),
    new THREE.MeshLambertMaterial({ color: pal.runway })
  );
  strip.position.set(0, runway.height + 0.1, 0);
  scene.add(strip);
  // Centre-line dashes.
  const dashGeo = new THREE.BoxGeometry(9, 0.15, 1.6);
  const dashMat = new THREE.MeshBasicMaterial({ color: pal.runwayMark });
  for (let x = -runway.length / 2 + 18; x < runway.length / 2 - 10; x += 26) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(x, runway.height + 0.55, 0);
    scene.add(dash);
  }
  // Threshold bars at both ends.
  const barGeo = new THREE.BoxGeometry(2.2, 0.15, runway.width - 6);
  for (const x of [-runway.length / 2 + 6, runway.length / 2 - 6]) {
    const bar = new THREE.Mesh(barGeo, dashMat);
    bar.position.set(x, runway.height + 0.55, 0);
    scene.add(bar);
  }
  // Edge lights: small warm dots down both sides.
  const lightGeo = new THREE.BoxGeometry(1.1, 0.8, 1.1);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let x = -runway.length / 2 + 8; x <= runway.length / 2 - 8; x += 28) {
    for (const z of [-runway.width / 2 - 1.2, runway.width / 2 + 1.2]) {
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(x, runway.height + 0.8, z);
      scene.add(light);
    }
  }

  // --- rings ------------------------------------------------------------
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(CFG.ringRadius, 1.3, 12, 42);
  for (let i = 0; i < CFG.ringCourse.length; i++) {
    const c = CFG.ringCourse[i];
    const mesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: pal.ringIdle, transparent: true, opacity: 0.85 })
    );
    mesh.position.set(c[0], c[1], c[2]);
    // Face the next ring on the course so the pilot flies through the hole.
    const next = CFG.ringCourse[(i + 1) % CFG.ringCourse.length];
    mesh.lookAt(next[0], next[1], next[2]);
    scene.add(mesh);
    rings.push({ mesh, pos: new THREE.Vector3(c[0], c[1], c[2]), index: i });
  }

  function setRingState(i, state) {
    const mat = rings[i].mesh.material;
    if (state === 'next') {
      mat.color.setHex(pal.ringNext);
      mat.opacity = 1;
    } else if (state === 'done') {
      mat.color.setHex(pal.ringDone);
      mat.opacity = 0.55;
    } else {
      mat.color.setHex(pal.ringIdle);
      mat.opacity = 0.7;
    }
  }
  for (let i = 0; i < rings.length; i++) setRingState(i, 'idle');
  setRingState(0, 'next');

  // --- per-frame world motion -------------------------------------------
  function update(dt, time) {
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.position.x += dt * 3.5;
      // A slow vertical bob on top of the drift, so the sky feels
      // alive rather than painted on.
      c.position.y = c.userData.baseY + Math.sin(time * 0.22 + c.userData.phase) * 2.5;
      if (c.position.x > 2400) c.position.x = -2400;
    }
    // Pulse the next ring so it is easy to spot from far away.
    for (let i = 0; i < rings.length; i++) {
      const mat = rings[i].mesh.material;
      if (mat.color.getHex() === pal.ringNext) {
        const s = 1 + Math.sin(time * 3.2) * 0.05;
        rings[i].mesh.scale.set(s, s, s);
      }
    }
  }

  return {
    heightAt,
    isOnRunway,
    runway: {
      center: new THREE.Vector3(0, runway.height, 0),
      headingRad: runwayHeading,
      length: runway.length,
      width: runway.width,
      height: runway.height,
    },
    rings,
    setRingState,
    update,
  };
}
