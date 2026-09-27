'use strict';
// Marrow House - map data. Tile = 1.5m. Positions in props/entities use tile coords [i, j]
// (tile centres) or explicit world x/z in metres.
(function (MH) {
  const S = MH.TILE, tw = MH.tw;

  const blank = (W, H, ch) => Array.from({ length: H }, () => Array(W).fill(ch));
  const toStrings = (g) => g.map((r) => r.join(''));
  const rect = (g, i0, j0, i1, j1, ch) => {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = ch;
  };

  // =====================================================================
  // THE YARD
  // =====================================================================
  const YW = 34, YH = 36;
  function yardGrid() {
    const g = blank(YW, YH, ',');
    const rnd = MH.seeded(4242);
    for (let j = 0; j < YH; j++) {
      for (let i = 0; i < YW; i++) {
        const e = Math.min(i, j, YW - 1 - i, YH - 1 - j);
        if (e < 3 || (e < 5 && rnd() < 0.3)) g[j][i] = 'T';
      }
    }
    rect(g, 3, 3, 30, 3, ','); // clear a strip behind the house
    rect(g, 8, 4, 20, 10, 'H');
    rect(g, 11, 11, 17, 12, 'p');
    rect(g, 24, 6, 29, 12, 'B');
    rect(g, 25, 7, 28, 11, 'b');
    g[9][24] = 'D';
    rect(g, 14, 13, 14, YH - 1, '.');
    rect(g, 13, 31, 15, YH - 1, '.');
    rect(g, 13, 32, 15, YH - 1, '.');
    // garden fence around the scarecrow
    rect(g, 22, 17, 29, 17, 'f'); rect(g, 22, 22, 29, 22, 'f');
    rect(g, 22, 17, 22, 22, 'f'); rect(g, 29, 17, 29, 22, 'f');
    g[22][25] = ','; g[22][26] = ',';
    // a few stands of trees inside the clearing
    for (const [i, j] of [[27, 26], [28, 26], [28, 27], [4, 27], [5, 27], [4, 28], [30, 14], [8, 14], [7, 26]]) g[j][i] = 'T';
    // markers
    g[9][4] = 'A'; g[10][4] = 'G'; g[11][14] = 'E'; g[30][15] = 'P'; g[31][14] = 'C';
    return toStrings(g);
  }

  const yardProps = (() => {
    const P = [
      { type: 'porch', x: tw(14), z: 11 * S, w: 10.5, d: 2.9 },
      { type: 'roof', x: 14.5 * S, z: 7.5 * S, w: 13 * S, d: 7 * S, y0: 4.2, rise: 2.8 },
      { type: 'roof', x: 27 * S, z: 9.5 * S, w: 7 * S, d: 6 * S, y0: 4.2, rise: 2.2, gable: 'barnred', rot: 1 },
      { type: 'wallpanel', at: [14, 11], wall: 'n', tex: 'frontdoor', w: 1.05, h: 2.1, y0: 0.12 },
      { type: 'window', at: [9, 11], wall: 'n' }, { type: 'window', at: [11, 11], wall: 'n' },
      { type: 'window', at: [17, 11], wall: 'n' }, { type: 'window', at: [19, 11], wall: 'n' },
      { type: 'window', at: [12, 11], wall: 'n', y0: 2.8, w: 0.8, h: 0.9 },
      { type: 'window', at: [16, 11], wall: 'n', y0: 2.8, w: 0.8, h: 0.9 },
      { type: 'window', at: [7, 6], wall: 'e' }, { type: 'window', at: [7, 8], wall: 'e' },
      { type: 'window', at: [21, 5], wall: 'w' },
      { type: 'appletree', at: [4, 9] },
      { type: 'grave', at: [4, 10] },
      { type: 'well', at: [6, 17] },
      { type: 'woodpile', at: [21, 8], wall: 'w', w: 2.4 },
      { type: 'scarecrow', at: [25, 19], rot: 3 },
      { type: 'clothesline', x: tw(7) + 0.75, z: tw(22), len: 5 },
      { type: 'mailbox', at: [13, 29] },
      { type: 'car', at: [14, 31] },
      { type: 'log', x: tw(14), z: tw(33), len: 7.5 },
      { type: 'workbench', at: [26, 7], wall: 'n' },
      { type: 'lamphook', at: [28, 10], wall: 'e' },
      { type: 'haybale', at: [25, 11], wall: 's', stack: true },
      { type: 'haybale', at: [27, 11], wall: 's' },
      { type: 'haybale', at: [28, 7], wall: 'n', stack: true },
      { type: 'crate', at: [25, 7], s: 0.8 },
    ];
    const rnd = MH.seeded(99);
    for (let k = 0; k < 40; k++) {
      const i = 3 + Math.floor(rnd() * (YW - 6)), j = 12 + Math.floor(rnd() * (YH - 16));
      if (Math.abs(i - 14) < 2) continue;
      P.push({ type: 'weeds', x: tw(i) + (rnd() - 0.5), z: tw(j) + (rnd() - 0.5), seed: k + 1, n: 2 + Math.floor(rnd() * 3) });
    }
    for (let k = 0; k < 10; k++) P.push({ type: 'weeds', x: tw(3 + Math.floor(rnd() * 5)), z: tw(4 + Math.floor(rnd() * 8)), seed: 60 + k });
    return P;
  })();

  MH.Maps = {};
  MH.Maps.yard = {
    id: 'yard', name: 'The Yard', seed: 77,
    grid: yardGrid,
    legend: {
      'T': { solid: true, tree: true, floor: 'snow', outdoor: true },
      ',': { floor: 'snow', outdoor: true, step: 'snow' },
      '.': { floor: 'gravelsnow', outdoor: true, step: 'snow' },
      'p': { floor: 'porchwood', outdoor: true, step: 'wood' },
      'H': { solid: true, wall: 'siding', h: 4.2, forceWall: true, top: 'roofsnow' },
      'B': { solid: true, wall: 'barnred', h: 4.2, top: 'roofsnow' },
      'b': { floor: 'hayfloor', ceil: 'barnwood', h: 3.9, wall: 'barnwood', step: 'dirt' },
      'D': { like: 'b', door: true, doorTex: 'barnwood', wall: 'barnred' },
      'f': { solid: true, fence: true, floor: 'snow', seeThrough: true },
      'A': { like: ',' }, 'G': { like: ',' }, 'E': { like: 'p' }, 'P': { like: ',' }, 'C': { like: '.' },
    },
    env: {
      night: { fog: [0.075, 0.08, 0.11], fogNear: 4, fogFar: 30, amb: [0.2, 0.22, 0.3], snow: true, ambience: 'wind', outdoor: true },
      morning: { fog: [0.62, 0.64, 0.68], fogNear: 6, fogFar: 42, amb: [0.72, 0.72, 0.75], snow: false, ambience: 'morning', outdoor: true },
    },
    lights: [
      { id: 'car1', x: tw(14), z: tw(31) - 4.2, y: 0.9, col: [1, 0.95, 0.8], radius: 10, intensity: 1.2, global: true, group: 'car' },
      { id: 'car2', x: tw(14), z: tw(31) - 9.5, y: 0.7, col: [1, 0.95, 0.8], radius: 8, intensity: 0.7, global: true, group: 'car' },
      { id: 'porch', x: tw(14), z: 11 * S + 0.6, y: 2.5, col: [1, 0.78, 0.45], radius: 7, intensity: 0.9, global: true, group: 'power', flicker: 0.05 },
    ],
    props: yardProps,
    spawns: {
      start: { x: tw(15), z: tw(30), yaw: 0.15 },
      porch: { x: tw(14), z: tw(11) + 0.4, yaw: Math.PI },
      barn: { x: tw(22), z: tw(9), yaw: 0 },
      morning: { x: tw(14), z: tw(12), yaw: Math.PI - 0.6 },
    },
  };

  // =====================================================================
  // THE HOUSE (ground floor)
  // =====================================================================
  MH.Maps.house = {
    id: 'house', name: 'Marrow House', seed: 5,
    grid: [
      '############C########',
      '#_____#S#,,,,,,,#ppp#',
      '#_____#.#,,,,,,,Dppp#',
      '#_____D.D,,,,,,,#ppp#',
      '#_____#.#,,,,,,,#####',
      '#_____#.#,,,,,,,#####',
      '###D###.####D########',
      '#:::::#.#;;;;;#~~~~~#',
      '#:::::D.D;;;;;#~~~~~#',
      '#:::::#.#;;;;;#~~~~~#',
      '#:::::#.#######D#####',
      '#:::::#.........#####',
      '#:::::D.#############',
      '#######...###########',
      '#######.f.###########',
      '########F############',
    ],
    legend: {
      '#': { solid: true },
      'C': { solid: true },
      'F': { solid: true },
      '.': { floor: 'woodfloor', ceil: 'plaster', wall: 'wallstripe', h: 2.7, baseboard: true, step: 'wood' },
      'S': { like: '.' }, 'f': { like: '.' },
      '_': { floor: 'carpet', ceil: 'plaster', wall: 'wallrose', h: 2.7, baseboard: true, step: 'carpet' },
      ',': { floor: 'linoleum', ceil: 'plaster', wall: 'kitchentile', h: 2.7, step: 'tile' },
      'p': { floor: 'woodfloor', ceil: 'plaster', wall: 'wallstripe', h: 2.7, step: 'wood' },
      ':': { floor: 'woodfloor', ceil: 'plaster', wall: 'wallpaper', h: 2.7, baseboard: true, step: 'wood' },
      ';': { floor: 'woodfloor', ceil: 'plaster', wall: 'panel', h: 2.7, step: 'wood' },
      '~': { floor: 'bathtile', ceil: 'plaster', wall: 'bathtile', h: 2.7, step: 'tile' },
      'D': { like: '.', door: true },
    },
    env: {
      lit: { fog: [0.03, 0.026, 0.022], fogNear: 2, fogFar: 18, amb: [0.12, 0.105, 0.09], ambience: 'house' },
      dark: { fog: [0.01, 0.01, 0.013], fogNear: 1, fogFar: 14, amb: [0.05, 0.05, 0.065], ambience: 'house' },
    },
    lights: [
      { id: 'hall1', at: [7, 2], y: 2.3, radius: 5, intensity: 0.85, group: 'power', fixture: 'bulb' },
      { id: 'hall2', at: [7, 7], y: 2.3, radius: 5, intensity: 0.8, group: 'power', fixture: 'bulb', flicker: 0.1 },
      { id: 'foyer', at: [8, 13], y: 2.3, radius: 5.5, intensity: 0.9, group: 'power', fixture: 'shade' },
      { id: 'kitchen', at: [12, 3], y: 2.3, radius: 7.5, intensity: 1.0, group: 'power', fixture: 'shade', col: [1, 0.92, 0.75], flicker: 0.06, buzz: true },
      { id: 'living', at: [3, 9], y: 2.2, radius: 6.5, intensity: 0.8, group: 'power', fixture: 'shade' },
      { id: 'bedroom', at: [3, 3], y: 2.3, radius: 5.5, intensity: 0.7, group: 'power', fixture: 'shade' },
      { id: 'study', at: [11, 8], y: 2.3, radius: 5, intensity: 0.8, group: 'power', fixture: 'bulb' },
      { id: 'bath', at: [17, 8], y: 2.3, radius: 5, intensity: 0.8, group: 'power', fixture: 'bulb', col: [0.85, 0.95, 1], flicker: 0.45 },
      { id: 'corr', at: [12, 11], y: 2.3, radius: 5, intensity: 0.55, group: 'power', fixture: 'bulb' },
    ],
    props: [
      // bedroom
      { type: 'bed', at: [3, 1], wall: 'n' },
      { type: 'nightstand', at: [4, 1], wall: 'n', off: [-0.3, 0] },
      { type: 'wardrobe', at: [1, 4], wall: 'w' },
      { type: 'dresser', at: [4, 5], wall: 's' },
      { type: 'rug', x: tw(3), z: tw(3) + 0.8, w: 2.6, d: 2.0 },
      { type: 'window', at: [1, 2], wall: 'w' },
      { type: 'wallpanel', at: [2, 5], wall: 's', tex: 'portrait', w: 0.6, h: 0.75, y0: 1.2, frame: 'darkwood' },
      // hall
      { type: 'clock', at: [7, 5], wall: 'w' },
      { type: 'rug', x: tw(7), z: tw(7), w: 0.8, d: 7.5, tex: 'carpet' },
      { type: 'wallpanel', at: [7, 4], wall: 'e', tex: 'portrait', w: 0.5, h: 0.65, y0: 1.3, frame: 'darkwood' },
      { type: 'wallpanel', at: [7, 9], wall: 'e', tex: 'portrait', w: 0.5, h: 0.65, y0: 1.3, frame: 'darkwood' },
      { type: 'wallpanel', at: [7, 11], wall: 'w', tex: 'portrait', w: 0.5, h: 0.65, y0: 1.3, frame: 'darkwood' },
      { type: 'coatrack', at: [9, 13], off: [0.35, -0.3] },
      { type: 'wallpanel', at: [7, 14], wall: 'w', tex: 'water', w: 0.6, h: 0.9, y0: 1.0, frame: 'darkwood', col: [1.4, 1.4, 1.5, 0.03] },
      // kitchen
      { type: 'counter', at: [9, 1], wall: 'n' },
      { type: 'counter', at: [10, 1], wall: 'n', sink: true, upper: false },
      { type: 'window', at: [10, 1], wall: 'n', y0: 1.3, w: 0.9, h: 0.8 },
      { type: 'counter', at: [11, 1], wall: 'n' },
      { type: 'stove', at: [13, 1], wall: 'n' },
      { type: 'counter', at: [14, 1], wall: 'n' },
      { type: 'counter', at: [15, 1], wall: 'n' },
      { type: 'fridge', at: [15, 4], wall: 'e' },
      { type: 'table', x: tw(12), z: tw(3) + 0.3, w: 2.0, d: 1.1 },
      { type: 'chair', x: tw(12) - 0.55, z: tw(3) + 1.2, rot: 2 },
      { type: 'chair', x: tw(12) + 0.55, z: tw(3) - 0.6, rot: 0 },
      { type: 'chair', x: tw(12) - 1.3, z: tw(3) + 0.3, rot: 1 },
      { type: 'wallpanel', at: [9, 4], wall: 'w', tex: 'calendar', w: 0.45, h: 0.55, y0: 1.3 },
      { type: 'plates', x: tw(12) - 0.55, z: 1 * S + 0.35, n: 3, tall: 4 },
      { type: 'plates', x: tw(12) + 0.6, z: 1 * S + 0.3, n: 2, tall: 3, seed: 3 },
      // pantry
      { type: 'shelf', at: [18, 1], wall: 'n', w: 1.4 },
      { type: 'shelf', at: [19, 2], wall: 'e', w: 1.4, seed: 5 },
      { type: 'shelf', at: [18, 3], wall: 's', w: 1.4, seed: 8 },
      // living room
      { type: 'fireplace', at: [1, 9], wall: 'w' },
      { type: 'armchair', x: tw(2) + 0.55, z: tw(9), rot: 3 },
      { type: 'sofa', at: [3, 12], wall: 's' },
      { type: 'tv', at: [4, 7], wall: 'n' },
      { type: 'bookshelf', at: [5, 10], wall: 'e' },
      { type: 'rug', x: tw(3), z: tw(9) + 0.5, w: 3.0, d: 2.4 },
      { type: 'window', at: [1, 7], wall: 'w' }, { type: 'window', at: [1, 11], wall: 'w' },
      { type: 'wallpanel', at: [2, 7], wall: 'n', tex: 'portrait', w: 0.55, h: 0.7, y0: 1.3, frame: 'darkwood' },
      { type: 'table', x: tw(4) + 0.3, z: tw(12) - 0.3, w: 0.6, d: 0.6, h: 0.5, block: false },
      // study
      { type: 'desk', at: [13, 8], wall: 'e' },
      { type: 'chair', x: tw(12) + 0.35, z: tw(8), rot: 1, nocollide: true },
      { type: 'bookshelf', at: [10, 9], wall: 's' },
      { type: 'bookshelf', at: [11, 9], wall: 's' },
      { type: 'wallpanel', at: [11, 7], wall: 'n', tex: 'crate', w: 1.1, h: 0.8, y0: 1.05, frame: 'darkwood' },
      { type: 'wallpanel', x: tw(11) + 0.15, z: tw(7) - 0.725, rot: 0, tex: 'newspaper', w: 0.42, h: 0.52, y0: 1.18 },
      { type: 'wallpanel', x: tw(11) - 0.3, z: tw(7) - 0.725, rot: 0, tex: 'paper', w: 0.2, h: 0.26, y0: 1.3 },
      { type: 'window', at: [9, 7], wall: 'n' },
      { type: 'crate', at: [9, 9], s: 0.55, h: 0.5, block: false },
      // bathroom
      { type: 'bathtub', x: tw(17) + 0.75, z: tw(7) - 0.33, rot: 1 },
      { type: 'toilet', at: [19, 9], wall: 'e' },
      { type: 'psink', at: [15, 7], wall: 'n' },
      { type: 'window', at: [19, 8], wall: 'e', y0: 1.4, w: 0.7, h: 0.7 },
      // corridor
      { type: 'wallpanel', at: [10, 11], wall: 's', tex: 'portrait', w: 0.5, h: 0.65, y0: 1.3, frame: 'darkwood' },
      { type: 'wallpanel', at: [13, 11], wall: 'n', tex: 'portrait', w: 0.5, h: 0.65, y0: 1.3, frame: 'darkwood' },
      { type: 'table', x: tw(11), z: tw(11) - 0.5, w: 0.8, d: 0.35, h: 0.8, block: false },
    ],
    spawns: {
      foyer: { x: tw(8), z: tw(14), yaw: 0 },
      attic: { x: tw(7), z: tw(2) + 0.2, yaw: Math.PI },
      cellar: { x: tw(12), z: tw(1) + 0.6, yaw: Math.PI },
    },
  };

  // =====================================================================
  // THE ATTIC
  // =====================================================================
  function atticGrid() {
    const g = blank(17, 11, '#');
    rect(g, 1, 1, 15, 9, '.');
    g[5][2] = 'L';
    return toStrings(g);
  }
  MH.Maps.attic = {
    id: 'attic', name: 'The Attic', seed: 9,
    grid: atticGrid,
    legend: {
      '#': { solid: true },
      '.': { floor: 'woodfloor', ceil: 'barnwood', wall: 'barnwood', h: 2.2, step: 'wood' },
      'L': { like: '.' },
    },
    env: {
      dark: { fog: [0.012, 0.012, 0.014], fogNear: 0.5, fogFar: 12, amb: [0.055, 0.055, 0.07], ambience: 'attic' },
    },
    lights: [
      { id: 'bulb', at: [8, 5], y: 1.9, radius: 6, intensity: 0.55, group: 'attic', fixture: 'bulb', flicker: 0.25 },
      { id: 'moon', at: [14, 2], y: 1.4, radius: 4, intensity: 0.35, col: [0.55, 0.62, 0.9] },
    ],
    props: [
      { type: 'rafter', x: 12, z: tw(2), len: 25, y: 1.95 },
      { type: 'rafter', x: 12, z: tw(5), len: 25, y: 1.95 },
      { type: 'rafter', x: 12, z: tw(8), len: 25, y: 1.95 },
      { type: 'crate', at: [5, 1], s: 1.0, stack: true },
      { type: 'crate', at: [5, 3], s: 0.9 },
      { type: 'crate', at: [9, 1], s: 1.1, stack: true },
      { type: 'crate', at: [11, 9], s: 0.9 },
      { type: 'crate', at: [13, 2], s: 0.8 },
      { type: 'crate', at: [4, 8], s: 1.0, stack: true },
      { type: 'crate', at: [7, 7], s: 0.7 },
      { type: 'crate', at: [12, 5], s: 0.9, stack: true },
      { type: 'crate', at: [9, 6], s: 0.7, h: 0.6 },
      { type: 'trunk', at: [15, 5], wall: 'e' },
      { type: 'rockinghorse', at: [3, 2], rot: 1 },
      { type: 'crib', at: [9, 9], wall: 's' },
      { type: 'wallpanel', at: [8, 1], wall: 'n', tex: 'drawing', w: 0.5, h: 0.5, y0: 1.1 },
      { type: 'wallpanel', at: [11, 1], wall: 'n', tex: 'portrait', w: 0.6, h: 0.8, y0: 0.4 },
      { type: 'window', at: [15, 2], wall: 'e', y0: 0.9, w: 0.7, h: 0.7 },
      { type: 'cobweb', x: 1 * S + 0.3, z: 1 * S + 0.3, s: 0.9, y: 2.2 },
      { type: 'cobweb', x: 16 * S - 0.3, z: 10 * S - 0.3, s: 0.9, y: 2.2, rot: 2 },
      { type: 'cobweb', x: 16 * S - 0.3, z: 1 * S + 0.3, s: 0.7, y: 2.2, rot: 3 },
      { type: 'dresser', at: [14, 9], wall: 's' },
      { type: 'bed', at: [14, 7], wall: 'e', depth: 2.1 },
    ],
    spawns: { ladder: { x: tw(3), z: tw(5), yaw: -Math.PI / 2 } },
  };

  // =====================================================================
  // THE CELLAR (and what lies beneath it)
  // =====================================================================
  function cellarGrid() {
    const g = blank(27, 23, '#');
    rect(g, 1, 1, 5, 4, 'o');
    g[1][1] = 's';
    g[3][6] = '=';
    rect(g, 7, 3, 15, 3, '.');
    rect(g, 15, 4, 15, 11, '.');
    rect(g, 10, 4, 10, 5, 't');
    rect(g, 3, 5, 3, 12, '.');
    rect(g, 4, 12, 15, 12, '.');
    rect(g, 4, 8, 6, 8, '.');
    rect(g, 16, 12, 21, 12, '.');
    rect(g, 21, 13, 21, 16, '.');
    rect(g, 15, 13, 15, 19, '.');
    rect(g, 16, 19, 17, 19, '.');
    rect(g, 18, 17, 24, 21, 'r');
    rect(g, 19, 10, 19, 11, '.');
    rect(g, 17, 7, 22, 9, 'c');
    rect(g, 13, 16, 14, 16, '.');
    return toStrings(g);
  }
  MH.Maps.cellar = {
    id: 'cellar', name: 'The Cellar', seed: 13,
    grid: cellarGrid,
    legend: {
      '#': { solid: true },
      'o': { floor: 'stone', ceil: 'darkwood', wall: 'stone', h: 2.4, step: 'tile' },
      's': { like: 'o', wall: 'black' },
      '.': { floor: 'dirt', ceil: 'dirt', wall: 'dirtroots', h: 2.3, step: 'dirt' },
      '=': { like: '.', wall: 'stone' },
      't': { like: '.', wall: 'tally' },
      'c': { floor: 'dirt', ceil: 'dirt', wall: 'dirt', h: 3.4, step: 'dirt' },
      'r': { floor: 'carpet', ceil: 'plaster', wall: 'wallrot', h: 2.5, step: 'carpet', baseboard: true, floorCol: [0.6, 0.55, 0.5, 0] },
    },
    env: {
      dark: { fog: [0.008, 0.007, 0.006], fogNear: 0.5, fogFar: 11.5, amb: [0.04, 0.036, 0.034], ambience: 'cellar' },
    },
    lights: [
      { id: 'upstairs', at: [1, 1], y: 2.2, radius: 4, intensity: 0.4, col: [0.5, 0.55, 0.75], off: [0, -0.3] },
      { id: 'room0', x: 35.1, z: tw(19), y: 1.75, radius: 9, intensity: 1.15, col: [1, 0.68, 0.35], on: false, flicker: 0.15, group: 'room0' },
    ],
    props: [
      { type: 'stairsup', at: [1, 1] },
      { type: 'shelf', at: [3, 1], wall: 'n', w: 1.4 },
      { type: 'shelf', at: [4, 1], wall: 'n', w: 1.4, seed: 21 },
      { type: 'barrel', at: [5, 1], off: [0.2, -0.2] },
      { type: 'barrel', at: [5, 4], off: [0.2, 0.2] },
      { type: 'barrel', at: [1, 4], off: [-0.2, 0.2] },
      { type: 'crate', at: [2, 4], s: 0.8 },
      { type: 'bones', at: [7, 3], n: 3, seed: 2 },
      { type: 'roots', at: [8, 3] }, { type: 'roots', at: [12, 3], rot: 1.2 }, { type: 'roots', at: [15, 6] },
      { type: 'roots', at: [3, 7], rot: 2 }, { type: 'roots', at: [9, 12] }, { type: 'roots', at: [15, 15], rot: 0.7 },
      { type: 'roots', at: [18, 12] }, { type: 'roots', at: [21, 14], rot: 1.9 }, { type: 'roots', at: [15, 18] },
      { type: 'platepile', at: [17, 7], n: 6 }, { type: 'platepile', at: [18, 9], n: 4, seed: 5 },
      { type: 'platepile', at: [21, 7], n: 7, seed: 8, tall: 2.4 }, { type: 'platepile', at: [22, 9], n: 5, seed: 12 },
      { type: 'platepile', at: [20, 7], n: 4, seed: 19, tall: 2.8 },
      { type: 'plates', at: [19, 9], n: 3, clean: true },
      { type: 'bones', at: [13, 16], n: 9, seed: 7 }, { type: 'bones', at: [14, 16], n: 6, seed: 9 },
      { type: 'bones', at: [5, 12], n: 4, seed: 11 },
      // room 0
      { type: 'lodgerbed', at: [24, 19], wall: 'e', depth: 2.8 },
      { type: 'wallpanel', at: [21, 17], wall: 'n', tex: 'sign0', w: 0.35, h: 0.35, y0: 1.6 },
      { type: 'nightstand', at: [24, 17], wall: 'n' },
      { type: 'dresser', at: [19, 21], wall: 's' },
      { type: 'chair', x: tw(19), z: tw(17) + 0.1, rot: 2 },
      { type: 'rug', x: tw(21), z: tw(19), w: 3.0, d: 2.2 },
      { type: 'wallpanel', at: [23, 17], wall: 'n', tex: 'portrait', w: 0.5, h: 0.65, y0: 1.2, frame: 'darkwood' },
      { type: 'wallpanel', at: [22, 21], wall: 's', tex: 'portrait', w: 0.5, h: 0.65, y0: 1.2, frame: 'darkwood' },
      { type: 'wallpanel', at: [18, 18], wall: 'w', tex: 'portrait', w: 0.5, h: 0.65, y0: 1.2, frame: 'darkwood' },
      { type: 'window', at: [24, 21], wall: 'e', col: [0.1, 0.1, 0.1, 0] },
    ],
    spawns: {
      stairs: { x: tw(1), z: tw(2) + 0.2, yaw: Math.PI },
    },
  };
})(window.MH);
