// Merpati Nusantara — all tuning constants in one place.
// Units: metres, seconds, radians. Speeds in m/s; the HUD converts to km/h.

const CFG = {
  // World
  worldSize: 6000,          // sea plane is worldSize x worldSize, centred on 0,0
  seaLevel: 0,              // water plane height
  islandCount: 7,           // islands besides the airstrip island
  maxIslandHeight: 62,      // tallest island peak, metres

  // Airstrip island (the home island, centred on the origin)
  homeRadius: 720,          // island radius
  homeHeight: 26,           // island peak height
  runway: {
    length: 280,            // runway strip length
    width: 26,              // runway strip width
    headingDeg: 90,         // runway points east (90 deg)
    height: 9,              // flattened strip height above sea
  },

  // Flight model
  maxSpeed: 92,             // m/s at full throttle (~331 km/h)
  cruiseSpeed: 55,          // comfortable cruise, m/s
  stallSpeed: 26,           // below this the nose drops and the stall warning shows
  accel: 0.55,              // how fast speed chases the throttle target (per second)
  turnBleed: 6,             // m/s lost per second at full bank
  climbBleed: 9,            // m/s lost per second at full climb pitch
  pitchRate: 0.85,          // rad/s of pitch from full stick
  rollRate: 1.5,            // rad/s of roll from full stick
  turnRate: 0.55,           // rad/s of heading change at full bank
  autoLevel: 1.4,           // how fast roll/pitch ease back to level (per second)
  maxPitch: 0.55,           // rad, nose up/down limit
  maxRoll: 1.05,            // rad, bank limit

  // Fuel
  fuelMax: 100,             // fuel gauge units
  fuelDrain: 0.42,          // units per second at full throttle (scaled by throttle)
  fuelRingBonus: 14,        // fuel restored by each ring
  fuelLandingRefill: 100,   // fuel after a safe runway landing

  // Rings
  ringCount: 8,             // rings in the Ring Run
  ringRadius: 17,           // ring opening radius, metres
  ringCatch: 15,            // 3D distance that counts as flying through
  ringScore: 100,           // points per ring

  // Scoring
  landingBonus: 500,        // points for landing after all rings
  timeBonusRate: 2,         // points per second under the par time
  parTimeSec: 600,          // par time for the full sortie

  // Camera
  camDistance: 26,          // chase camera distance behind the plane
  camHeight: 8,             // chase camera height above the plane
  camLerp: 5,               // how fast the camera chases (per second)
  camOrbitMax: 0.6,         // radians of mouse-drag orbit around the plane

  // Colours (one warm tropical palette for the whole game)
  palette: {
    sea: 0x1a6f8f,
    seaDeep: 0x0d4a68,
    sand: 0xe8d29a,
    grass: 0x4f9e4d,
    rock: 0x8a7a68,
    sky: 0x9fd4ef,
    cloud: 0xffffff,
    runway: 0x3a3f46,
    runwayMark: 0xf5f5f0,
    planeWhite: 0xf2f0e8,
    planeRed: 0xc8102e,
    ringNext: 0xffc21a,
    ringDone: 0x39d353,
    ringIdle: 0x7fd4ff,
  },
};

// Ring course: eight rings in a set order around the islands.
// Each entry: [x, y, z] in world metres. Altitudes keep the run low
// over the water and between islands so the terrain is always in view.
CFG.ringCourse = [
  [ 420,  55, -380],
  [ 950,  80,   120],
  [ 620,  60,   820],
  [-180,  95,  1050],
  [-820,  70,   620],
  [-1050, 110,  -260],
  [-560,  65,  -900],
  [ 180,  50,  -700],
];

// Islands besides the home island: [x, z, radius, height].
// Placed so the ring course threads between them.
CFG.islands = [
  [ 1050,  -350,  420,  48],
  [  900,   650,  520,  58],
  [ -350,  1150,  460,  52],
  [ -950,   450,  380,  44],
  [-1150,  -550,  480,  62],
  [ -450, -1050,  400,  50],
  [  650, -1150,  360,  42],
];

// Palm trees: [island index, angle around the island, distance from centre].
// Island 0 is the home island; the rest follow CFG.islands in order.
CFG.palms = [
  [0, 0.4, 520], [0, 1.1, 560], [0, 2.2, 480], [0, 3.0, 540], [0, 4.4, 500],
  [0, 5.2, 580], [0, 5.9, 520], [1, 0.8, 300], [1, 2.6, 320], [1, 4.0, 280],
  [2, 0.3, 380], [2, 1.9, 400], [2, 3.6, 360], [2, 5.1, 390],
  [3, 1.2, 330], [3, 2.8, 350], [3, 4.6, 320],
  [4, 0.6, 280], [4, 2.4, 300], [4, 4.2, 260],
  [5, 1.0, 340], [5, 3.1, 360], [5, 5.0, 330],
  [6, 0.9, 290], [6, 2.7, 310], [6, 4.5, 280],
  [7, 1.4, 260], [7, 3.3, 280], [7, 5.3, 250],
];
