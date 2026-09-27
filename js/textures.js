'use strict';
// Marrow House - procedural texture atlas. Every texture is generated at load time
// at 64x64 so it looks like it came off a 1990s memory card.
(function (MH) {
  const SZ = 64, ATLAS = 1024, PER = ATLAS / SZ;

  const cache = {};
  const nz = (seed, P) => cache[seed + ':' + P] || (cache[seed + ':' + P] = MH.makeNoise(seed, P));
  const fbm = (seed, x, y, P, oct) => {
    oct = oct || 3;
    let s = 0, a = 1, t = 0;
    for (let o = 0; o < oct; o++) {
      const p = P << o;
      s += a * nz(seed + o * 101, p)((x / SZ) * p, (y / SZ) * p);
      t += a; a *= 0.5;
    }
    return s / t;
  };
  const h2 = (x, y, s) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + (s || 0) * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const add = (c, v) => [c[0] + v, c[1] + v, c[2] + v];
  const grime = (c, x, y, seed, amt) => mul(c, 1 - amt * Math.max(0, fbm(seed, x, y, 4, 3) - 0.35) * 1.6);
  const grain = (c, x, y, seed, amt) => add(c, (h2(x, y, seed) - 0.5) * amt);

  const T = {}; // name -> generator (either {px} or {draw})

  // ---------- walls ----------
  T.wallpaper = { px: (x, y) => { // dusty green damask
    let c = [74, 88, 70];
    const u = (x % 16) - 8, v = ((y + (Math.floor(x / 16) % 2) * 8) % 16) - 8;
    const d = Math.abs(u) + Math.abs(v);
    if (d === 7 || d === 6) c = [98, 110, 84];
    if (u * u + v * v < 6) c = [128, 112, 70];
    if (Math.abs(u) < 1 && Math.abs(v) < 4) c = [110, 100, 66];
    c = grain(c, x, y, 1, 10);
    c = grime(c, x, y, 11, 0.55);
    const drip = fbm(12, x * 4, y * 0.3, 4, 2);
    if (drip > 0.68) c = mul(c, 0.75);
    return c;
  } };
  T.wallstripe = { px: (x, y) => {
    const s = Math.floor(x / 8) % 2;
    let c = s ? [96, 78, 62] : [82, 64, 52];
    if (x % 8 === 0) c = [122, 100, 66];
    c = grain(c, x, y, 2, 8);
    c = grime(c, x, y, 21, 0.5);
    const peel = fbm(22, x, y, 8, 3);
    if (peel > 0.72) c = mix(c, [140, 128, 108], 0.6);
    return c;
  } };
  T.wallrose = { px: (x, y) => {
    let c = [112, 80, 82];
    const u = x % 12, v = (y + (Math.floor(x / 12) % 2) * 6) % 12;
    if ((u - 6) * (u - 6) + (v - 6) * (v - 6) < 5) c = [150, 104, 100];
    if (u === 6 && v > 8) c = [80, 96, 66];
    c = grain(c, x, y, 3, 8);
    c = grime(c, x, y, 31, 0.55);
    return c;
  } };
  T.wallrot = { px: (x, y) => { // wallpaper rotting in the dark
    let c = [88, 84, 62];
    const u = (x % 16) - 8, v = (y % 16) - 8;
    if (Math.abs(u) + Math.abs(v) === 6) c = [110, 100, 70];
    c = grain(c, x, y, 4, 12);
    const f = fbm(41, x, y, 4, 4);
    c = mix(c, [52, 38, 26], MH.smoothstep(0.4, 0.75, f));
    if (fbm(42, x * 3, y * 0.4, 4, 2) > 0.62) c = mul(c, 0.6);
    return c;
  } };
  T.kitchentile = { px: (x, y) => {
    let c = [178, 170, 140];
    if (x % 16 === 0 || y % 16 === 0) c = [88, 84, 72];
    c = grain(c, x, y, 5, 10);
    c = grime(c, x, y, 51, 0.6);
    return c;
  } };
  T.panel = { px: (x, y) => {
    const b = Math.floor(x / 16);
    let c = mul([78, 50, 32], 0.9 + h2(b, 0, 6) * 0.2);
    const lx = x % 16;
    if (lx === 0) c = [30, 20, 14];
    if (lx === 1 || lx === 15) c = mul(c, 0.75);
    c = mul(c, 0.9 + 0.1 * Math.sin((y + fbm(61, x, y, 4) * 30) * 0.6));
    return grain(c, x, y, 6, 8);
  } };
  T.brick = { px: (x, y) => {
    const row = Math.floor(y / 8);
    const xo = (x + (row % 2) * 8) % 16;
    let c = mul([118, 56, 42], 0.8 + h2(Math.floor((x + (row % 2) * 8) / 16), row, 7) * 0.35);
    if (y % 8 === 0 || xo === 0) c = [86, 80, 70];
    c = grain(c, x, y, 7, 14);
    return grime(c, x, y, 71, 0.4);
  } };
  T.hearth = { px: (x, y) => {
    const row = Math.floor(y / 8);
    const xo = (x + (row % 2) * 8) % 16;
    let c = mul([56, 42, 36], 0.8 + h2(Math.floor((x + (row % 2) * 8) / 16), row, 8) * 0.3);
    if (y % 8 === 0 || xo === 0) c = [30, 28, 26];
    c = mul(c, 0.5 + 0.5 * (y / 64));
    return grain(c, x, y, 8, 10);
  } };
  T.stone = { px: (x, y) => {
    const row = Math.floor(y / 16);
    const bw = 21;
    const off = (row * 9) % bw;
    const col = Math.floor((x + off) / bw);
    let c = mul([86, 83, 76], 0.75 + h2(col, row, 9) * 0.35);
    if (y % 16 < 1 || (x + off) % bw < 1) c = [36, 34, 30];
    c = mul(c, 0.8 + 0.4 * fbm(91, x, y, 8, 3));
    return grain(c, x, y, 9, 16);
  } };
  T.dirt = { px: (x, y) => {
    let c = mix([58, 42, 30], [84, 64, 44], fbm(101, x, y, 4, 4));
    if (h2(x, y, 10) > 0.97) c = [110, 100, 88];
    return grain(c, x, y, 10, 18);
  } };
  T.dirtroots = { px: (x, y) => {
    let c = mix([54, 40, 28], [80, 60, 42], fbm(111, x, y, 4, 4));
    const r1 = Math.abs(x - 20 - 8 * Math.sin(y * 0.15) - fbm(112, x, y, 4) * 10);
    const r2 = Math.abs(x - 48 - 6 * Math.sin(y * 0.23 + 2) - fbm(113, x, y, 4) * 8);
    const r3 = Math.abs(y - 40 - 5 * Math.sin(x * 0.2) - fbm(114, x, y, 4) * 8);
    if (r1 < 1.5 || r2 < 1.1 || (r3 < 1.0 && x > 10 && x < 44)) c = [30, 22, 16];
    else if (r1 < 2.5 || r2 < 2) c = mul(c, 0.8);
    return grain(c, x, y, 11, 16);
  } };
  T.tally = { px: (x, y) => {
    let c = mix([58, 44, 32], [86, 66, 46], fbm(121, x, y, 4, 4));
    const gx = x % 16, gy = y % 21;
    const g = Math.floor(x / 16) + Math.floor(y / 21) * 4;
    if (gy > 3 && gy < 17 && h2(g, 1, 12) > 0.1) {
      for (let k = 0; k < 6; k++) if (gx === 2 + k * 2) c = [150, 130, 105];
      const dy = gy - 4, dx = gx - 1;
      if (Math.abs(dy * 0.95 - dx * 1.0) < 0.8 && gx < 15) c = [160, 140, 110];
    }
    return grain(c, x, y, 12, 14);
  } };
  T.plaster = { px: (x, y) => {
    let c = [142, 136, 124];
    c = mul(c, 0.85 + 0.15 * fbm(131, x, y, 4, 3));
    const st = fbm(132, x, y, 2, 3);
    if (st > 0.6) c = mix(c, [110, 90, 60], MH.smoothstep(0.6, 0.75, st) * 0.7);
    const crack = Math.abs(y - 30 - 12 * Math.sin(x * 0.12) - fbm(133, x, y, 8) * 12);
    if (crack < 0.8) c = [70, 66, 60];
    return grain(c, x, y, 13, 8);
  } };
  T.siding = { px: (x, y) => {
    let c = [150, 148, 140];
    const ly = y % 8;
    if (ly === 7) c = [58, 58, 56];
    else if (ly === 6) c = [110, 108, 102];
    if (fbm(141, x, y, 4, 3) > 0.68) c = ly < 6 ? [96, 78, 60] : c;
    c = grime(c, x, y, 142, 0.5);
    return grain(c, x, y, 14, 8);
  } };
  T.roofsnow = { px: (x, y) => {
    let c = [178, 184, 198];
    const row = Math.floor(y / 8);
    const sx = (x + (row % 2) * 6) % 12;
    if (fbm(151, x, y, 4, 3) > 0.62 && (y % 8 < 3)) c = sx === 0 ? [30, 30, 32] : [60, 60, 64];
    return grain(c, x, y, 15, 10);
  } };
  T.barnwood = { px: (x, y) => {
    const b = Math.floor(x / 12);
    let c = mul([92, 78, 64], 0.8 + h2(b, 3, 16) * 0.35);
    const lx = x % 12;
    if (lx === 0) c = [26, 22, 18];
    c = mul(c, 0.88 + 0.12 * Math.sin((y + fbm(161, x, y, 4) * 40) * 0.5 + b));
    if ((y === 8 || y === 56) && (lx === 3 || lx === 8)) c = [30, 30, 32];
    return grain(c, x, y, 16, 12);
  } };
  T.barnred = { px: (x, y) => {
    const b = Math.floor(x / 12);
    let c = mul([104, 38, 32], 0.8 + h2(b, 4, 17) * 0.3);
    if (x % 12 === 0) c = [30, 16, 14];
    const f = fbm(171, x, y, 4, 3);
    if (f > 0.62) c = mix(c, [96, 84, 70], MH.smoothstep(0.62, 0.75, f));
    return grain(c, x, y, 17, 12);
  } };

  // ---------- floors ----------
  T.woodfloor = { px: (x, y) => {
    const row = Math.floor(y / 8);
    const joint = Math.floor(h2(row, 0, 18) * 64);
    const seg = x >= joint ? 1 : 0;
    let c = mul([92, 62, 40], 0.75 + h2(row, seg, 19) * 0.4);
    if (y % 8 === 0 || x === joint) c = [28, 18, 12];
    c = mul(c, 0.9 + 0.1 * Math.sin((x + fbm(181, x, y, 4) * 40) * 0.35));
    c = grime(c, x, y, 182, 0.5);
    return grain(c, x, y, 18, 10);
  } };
  T.porchwood = { px: (x, y) => {
    const row = Math.floor(x / 10);
    let c = mul([100, 92, 84], 0.75 + h2(row, 2, 20) * 0.35);
    if (x % 10 === 0) c = [30, 28, 26];
    const sn = fbm(191, x, y, 4, 3);
    if (sn > 0.55) c = mix(c, [185, 190, 205], MH.smoothstep(0.55, 0.62, sn));
    return grain(c, x, y, 20, 10);
  } };
  T.linoleum = { px: (x, y) => {
    let c = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2) ? [44, 42, 40] : [168, 160, 140];
    c = grime(c, x, y, 201, 0.55);
    return grain(c, x, y, 21, 10);
  } };
  T.bathtile = { px: (x, y) => {
    let c = [170, 186, 176];
    if (x % 8 === 0 || y % 8 === 0) c = [96, 104, 96];
    const m = fbm(211, x, y, 4, 3);
    if (m > 0.64) c = mix(c, [40, 56, 36], MH.smoothstep(0.64, 0.8, m));
    return grain(c, x, y, 22, 8);
  } };
  T.carpet = { px: (x, y) => {
    let c = [92, 28, 30];
    const u = (x % 32) - 16, v = (y % 32) - 16;
    const d = Math.abs(u) + Math.abs(v);
    if (d === 12 || d === 11) c = [150, 110, 60];
    if (d < 4) c = [40, 30, 50];
    if (x % 32 === 0 || y % 32 === 0) c = [60, 20, 20];
    const w = fbm(221, x, y, 4, 3);
    if (w > 0.62) c = mix(c, [120, 90, 80], 0.5);
    return grain(c, x, y, 23, 14);
  } };
  T.rug = { px: (x, y) => {
    const dx = (x - 31.5) / 31, dy = (y - 31.5) / 31;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 1) return [0, 0, 0, 0];
    const band = Math.floor(r * 7);
    const cols = [[120, 50, 40], [90, 80, 60], [60, 70, 90], [130, 110, 70], [80, 40, 40], [100, 90, 70], [60, 50, 40]];
    let c = cols[band];
    if (((x + y) % 4) < 2) c = mul(c, 0.85);
    return grain(c, x, y, 24, 12).concat(255);
  } };
  T.snow = { px: (x, y) => {
    let c = mix([150, 158, 178], [196, 202, 216], fbm(241, x, y, 4, 4));
    if (h2(x, y, 25) > 0.985) c = [235, 240, 255];
    return grain(c, x, y, 25, 6);
  } };
  T.gravelsnow = { px: (x, y) => {
    let c = mix([150, 158, 178], [190, 196, 210], fbm(251, x, y, 4, 4));
    const rut = Math.min(Math.abs(x - 16), Math.abs(x - 48));
    if (rut < 5) c = mix(c, [92, 90, 92], 0.55 * (1 - rut / 5) + 0.2 * fbm(252, x, y, 8));
    if (fbm(253, x, y, 8, 2) > 0.66) c = [96, 92, 88];
    return grain(c, x, y, 26, 10);
  } };
  T.hayfloor = { px: (x, y) => {
    let c = mix([70, 58, 40], [110, 94, 58], fbm(261, x, y, 4, 3));
    if (h2(Math.floor(x / 3), y, 27) > 0.8) c = [150, 128, 70];
    return grain(c, x, y, 27, 14);
  } };

  // ---------- furniture / objects ----------
  T.darkwood = { px: (x, y) => {
    let c = [66, 42, 28];
    c = mul(c, 0.85 + 0.15 * Math.sin((x + fbm(271, x, y, 4) * 30) * 0.7));
    return grain(c, x, y, 28, 8);
  } };
  T.lightwood = { px: (x, y) => {
    let c = [128, 96, 62];
    c = mul(c, 0.85 + 0.15 * Math.sin((y + fbm(281, x, y, 4) * 30) * 0.6));
    return grain(c, x, y, 29, 8);
  } };
  T.fabric = { px: (x, y) => {
    let c = [78, 86, 58];
    const u = (x + 4 * (Math.floor(y / 16) % 2)) % 16, v = y % 16;
    if ((u - 8) * (u - 8) + (v - 8) * (v - 8) < 10) c = [126, 76, 64];
    if ((u - 8) * (u - 8) + (v - 8) * (v - 8) < 2) c = [150, 130, 80];
    c = grime(c, x, y, 291, 0.4);
    return grain(c, x, y, 30, 12);
  } };
  T.quilt = { px: (x, y) => {
    const cols = [[120, 60, 50], [70, 90, 110], [150, 130, 90], [80, 100, 60], [110, 80, 100], [140, 110, 70]];
    const q = Math.floor(x / 16) + Math.floor(y / 16) * 4;
    let c = cols[Math.floor(h2(q, 0, 31) * cols.length)];
    if (x % 16 === 0 || y % 16 === 0) c = [200, 190, 170];
    if ((x + y) % 5 === 0) c = mul(c, 0.9);
    return grime(grain(c, x, y, 31, 10), x, y, 311, 0.3);
  } };
  T.sheets = { px: (x, y) => {
    let c = [168, 162, 146];
    c = mul(c, 0.85 + 0.15 * Math.sin(x * 0.3 + Math.sin(y * 0.1) * 3));
    const s = fbm(321, x, y, 4, 3);
    if (s > 0.66) c = mix(c, [120, 100, 70], 0.5);
    return grain(c, x, y, 32, 8);
  } };
  T.mattress = { px: (x, y) => {
    let c = [110, 96, 72];
    if (x % 10 === 0) c = [90, 78, 60];
    const s = fbm(331, x, y, 4, 4);
    c = mix(c, [40, 30, 20], MH.smoothstep(0.5, 0.8, s));
    return grain(c, x, y, 33, 10);
  } };
  T.metalwhite = { px: (x, y) => {
    let c = [182, 178, 166];
    c = grime(c, x, y, 341, 0.35);
    const r = fbm(342, x, y, 8, 2);
    if (r > 0.72) c = [120, 72, 44];
    return grain(c, x, y, 34, 6);
  } };
  T.metaldark = { px: (x, y) => grain(mul([52, 52, 56], 0.8 + 0.3 * fbm(351, x, y, 4, 3)), x, y, 35, 10) };
  T.iron = { px: (x, y) => {
    let c = mix([50, 38, 30], [96, 60, 36], fbm(361, x, y, 8, 3));
    return grain(c, x, y, 36, 14);
  } };
  T.counter = { px: (x, y) => {
    let c = [150, 140, 116];
    if (h2(x, y, 37) > 0.9) c = [90, 84, 72];
    if (h2(x, y, 38) > 0.95) c = [190, 180, 160];
    return grime(c, x, y, 371, 0.3);
  } };
  T.cabinet = { px: (x, y) => {
    let c = [112, 84, 54];
    const inPanel = x > 6 && x < 58 && y > 6 && y < 58;
    const edge = (x === 6 || x === 58 || y === 6 || y === 58) && x >= 6 && x <= 58 && y >= 6 && y <= 58;
    if (edge) c = [60, 42, 26];
    else if (inPanel) c = [124, 94, 60];
    if (x >= 50 && x <= 53 && y >= 26 && y <= 36) c = [170, 150, 90];
    c = mul(c, 0.9 + 0.1 * Math.sin((y + fbm(381, x, y, 4) * 30) * 0.5));
    return grain(c, x, y, 38, 8);
  } };
  T.drawers = { px: (x, y) => {
    let c = [80, 52, 32];
    const d = Math.floor(y / 21), ly = y % 21;
    if (ly === 0 || x < 2 || x > 61) c = [40, 26, 16];
    const kx = x - 32, ky = ly - 10;
    if (kx * kx + ky * ky < 6) c = [160, 140, 80];
    void d;
    c = mul(c, 0.9 + 0.1 * Math.sin((x + fbm(391, x, y, 4) * 30) * 0.5));
    return grain(c, x, y, 39, 8);
  } };
  T.wardrobe = { px: (x, y) => {
    let c = [72, 46, 30];
    const lx = x % 32;
    if (lx === 0 || lx === 31) c = [32, 20, 12];
    if (lx > 4 && lx < 27 && ((y > 4 && y < 30) || (y > 34 && y < 60))) c = [82, 54, 34];
    if ((lx === 27 && x < 32) || (lx === 4 && x > 32)) if (y > 28 && y < 36) c = [170, 150, 90];
    c = mul(c, 0.9 + 0.1 * Math.sin((y + fbm(401, x, y, 4) * 30) * 0.5));
    return grain(c, x, y, 40, 8);
  } };
  T.books = { px: (x, y) => {
    const shelf = Math.floor(y / 16), ly = y % 16;
    if (ly < 2) return [56, 36, 22];
    let bx = 0, k = 0, found = null;
    while (bx < 64) {
      const w = 2 + Math.floor(h2(k, shelf, 41) * 4);
      if (x >= bx && x < bx + w) { found = k; break; }
      bx += w; k++;
    }
    const hgt = 9 + Math.floor(h2(found, shelf, 42) * 5);
    if (16 - ly > hgt) return [20, 14, 10];
    const cols = [[90, 30, 30], [40, 50, 80], [60, 70, 40], [110, 90, 50], [70, 40, 60], [40, 40, 40], [120, 110, 90]];
    let c = cols[Math.floor(h2(found, shelf, 43) * cols.length)];
    if (x === bx) c = mul(c, 0.6);
    if (ly === 8) c = [170, 150, 90];
    return grime(grain(c, x, y, 44, 10), x, y, 441, 0.35);
  } };
  T.crate = { px: (x, y) => {
    let c = mul([116, 90, 58], 0.85 + h2(Math.floor(y / 16), 0, 45) * 0.3);
    if (y % 16 === 0) c = [50, 36, 22];
    if (x < 5 || x > 58 || y < 5 || y > 58) c = [86, 64, 40];
    if (Math.abs(x - y) < 3 && x > 5 && x < 58) c = [92, 70, 44];
    return grime(grain(c, x, y, 45, 10), x, y, 451, 0.4);
  } };
  T.hay = { px: (x, y) => {
    let c = mix([120, 100, 50], [176, 150, 80], h2(Math.floor(x / 2), Math.floor(y / 6) + x % 3, 46));
    if (y % 21 === 0) c = [60, 50, 30];
    return grain(c, x, y, 46, 16);
  } };
  T.door = { px: (x, y) => {
    let c = [96, 64, 40];
    const pan = (x0, y0, x1, y1) => x > x0 && x < x1 && y > y0 && y < y1;
    const edge = (x0, y0, x1, y1) => pan(x0 - 1, y0 - 1, x1 + 1, y1 + 1) && !pan(x0 + 1, y0 + 1, x1 - 1, y1 - 1);
    if (edge(8, 5, 28, 28) || edge(36, 5, 56, 28) || edge(8, 34, 28, 60) || edge(36, 34, 56, 60)) c = [58, 36, 22];
    if (x < 2 || x > 61 || y < 2) c = [48, 30, 18];
    if ((x - 52) * (x - 52) + (y - 31) * (y - 31) < 5) c = [180, 150, 80];
    c = mul(c, 0.9 + 0.1 * Math.sin((y + fbm(471, x, y, 4) * 20) * 0.4));
    return grime(grain(c, x, y, 47, 8), x, y, 472, 0.35);
  } };
  T.frontdoor = { px: (x, y) => {
    let c = [70, 40, 34];
    if (x > 10 && x < 54 && y > 6 && y < 24) c = [26, 30, 40];
    if ((x === 32 && y > 6 && y < 24) || (y === 15 && x > 10 && x < 54)) c = [70, 40, 34];
    if (x > 10 && x < 54 && y > 30 && y < 58 && (x === 11 || x === 53 || y === 31 || y === 57)) c = [40, 24, 20];
    if ((x - 52) * (x - 52) + (y - 34) * (y - 34) < 5) c = [180, 150, 80];
    return grime(grain(c, x, y, 48, 8), x, y, 481, 0.4);
  } };
  T.cellardoor = { px: (x, y) => {
    const b = Math.floor(x / 11);
    let c = mul([72, 56, 40], 0.8 + h2(b, 5, 49) * 0.3);
    if (x % 11 === 0) c = [20, 16, 12];
    if ((y > 8 && y < 13) || (y > 50 && y < 55)) c = [40, 38, 38];
    // chain diagonal
    const d1 = Math.abs((x - 4) - (y - 6) * 0.9), d2 = Math.abs((60 - x) - (y - 6) * 0.9);
    if ((d1 < 2.4 || d2 < 2.4) && y > 4 && y < 62) {
      const link = Math.floor((x + y) / 4) % 2;
      c = link ? [120, 120, 124] : [70, 70, 74];
    }
    if (x > 27 && x < 37 && y > 30 && y < 42) c = [90, 80, 50];
    if (x > 29 && x < 35 && y > 25 && y < 31 && (x === 30 || x === 34)) c = [100, 100, 100];
    // gouges
    if (fbm(491, x * 3, y * 0.4, 4, 2) > 0.7 && (x < 8 || x > 56)) c = [140, 118, 90];
    return grain(c, x, y, 49, 10);
  } };
  T.cellarhole = { px: (x, y) => {
    let c = [6, 5, 4];
    const edge = Math.min(x, 63 - x);
    const jag = 3 + fbm(501, x, y, 8, 2) * 8;
    if (edge < jag && y > 2) c = mul([72, 56, 40], 0.7 + h2(x, 0, 50) * 0.3);
    if (y < 3) c = [30, 24, 18];
    return grain(c, x, y, 50, 6);
  } };
  T.window = { px: (x, y) => {
    let c = mix([22, 28, 44], [44, 54, 78], y / 64);
    if (y > 50) c = mix(c, [150, 160, 180], (y - 50) / 14 * fbm(511, x, y, 8, 2));
    if (h2(x, y, 51) > 0.992) c = [200, 205, 220];
    if (x < 4 || x > 59 || y < 4 || y > 59 || Math.abs(x - 31.5) < 1.6 || Math.abs(y - 31.5) < 1.6) c = [132, 126, 112];
    return grain(c, x, y, 51, 6);
  } };
  T.portrait = { px: (x, y) => {
    if (x < 5 || x > 58 || y < 5 || y > 58) return grain(x < 2 || x > 61 || y < 2 || y > 61 ? [60, 40, 20] : [120, 90, 40], x, y, 52, 20);
    let c = [34, 28, 24];
    const hx = (x - 32) / 9, hy = (y - 25) / 11;
    const body = y > 38 && Math.abs(x - 32) < 17 - (58 - y) * 0.3;
    if (body) c = [44, 38, 50];
    if (hx * hx + hy * hy < 1) {
      c = [150, 132, 110];
      if (Math.sin(x * 2.1 + y * 1.3) > 0.2 && hy > -0.7 && hy < 0.6) c = [20, 16, 14];
    }
    return grime(grain(c, x, y, 53, 8), x, y, 531, 0.3);
  } };
  T.photo = { px: (x, y) => {
    if (x < 4 || x > 59 || y < 4 || y > 48) return grain([220, 214, 196], x, y, 54, 8);
    let c = mix([120, 150, 90], [170, 180, 110], y / 48);
    if (y > 36) c = [96, 120, 60];
    // grandma
    const gx = (x - 22) / 5, gy = (y - 16) / 6;
    if (gx * gx + gy * gy < 1) c = [200, 170, 150];
    if (gx * gx + (gy + 0.9) * (gy + 0.9) < 0.7) c = [210, 210, 214];
    if (y > 21 && y < 46 && Math.abs(x - 22) < 7) c = [110, 60, 70];
    // dog
    const dx = (x - 40) / 9, dy = (y - 36) / 5;
    if (dx * dx + dy * dy < 1) c = [180, 130, 60];
    const hx = (x - 48) / 4, hy = (y - 30) / 4;
    if (hx * hx + hy * hy < 1) c = [185, 135, 65];
    if (x === 51 && y > 24 && y < 28) c = [150, 100, 45];
    if (x >= 45 && x <= 47 && y >= 25 && y <= 26) c = [150, 100, 45];
    if (y > 38 && y < 44 && (x === 34 || x === 36 || x === 44 || x === 46)) c = [160, 110, 50];
    c = mix(c, [200, 170, 120], 0.25);
    return grain(c, x, y, 55, 10);
  } };
  T.clockface = { px: (x, y) => {
    let c = [60, 38, 24];
    const dx = x - 32, dy = y - 32, r = Math.sqrt(dx * dx + dy * dy);
    if (r < 26) {
      c = [200, 190, 160];
      const a = Math.atan2(dy, dx);
      if (r > 20 && Math.abs(Math.sin(a * 6)) < 0.12) c = [30, 30, 30];
      if (Math.abs(dx) < 1.2 && dy < 0 && dy > -18) c = [20, 20, 20];
      if (Math.abs(dy) < 1.2 && dx > 0 && dx < 12) c = [20, 20, 20];
    }
    if (r >= 26 && r < 28) c = [160, 130, 60];
    return grain(c, x, y, 56, 8);
  } };
  T.tvstatic = { px: (x, y) => { const v = h2(x, y, 57) * 200 + 30; return [v, v, v * 1.05]; } };
  T.tvoff = { px: (x, y) => {
    let c = mix([22, 28, 26], [40, 48, 44], 1 - Math.abs(y - 32) / 32);
    if (Math.abs((x - y) - 10) < 3 && x < 30) c = [70, 80, 78];
    return grain(c, x, y, 58, 6);
  } };
  T.paper = { px: (x, y) => {
    let c = [206, 196, 164];
    if (y > 8 && y % 6 === 0 && x > 6 && x < 58 && h2(Math.floor(x / 5), y, 59) > 0.25) c = [60, 60, 80];
    c = grime(c, x, y, 591, 0.25);
    return grain(c, x, y, 59, 8);
  } };
  T.newspaper = { px: (x, y) => {
    let c = [182, 178, 164];
    if (y > 4 && y < 12 && x > 4 && x < 60) c = [30, 30, 30];
    if (y > 16 && y < 38 && x > 34 && x < 60) c = mix([70, 70, 70], [120, 120, 120], fbm(601, x, y, 4));
    if (y > 16 && y % 4 === 0 && ((x > 4 && x < 30) || (y > 40 && x > 4 && x < 60))) c = [80, 80, 80];
    return grime(grain(c, x, y, 60, 8), x, y, 602, 0.3);
  } };
  T.calendar = { px: (x, y) => {
    let c = [210, 204, 190];
    if (y < 16) c = [150, 60, 50];
    if (y >= 20 && (x % 9 === 2 || (y - 20) % 8 === 0) && x > 1 && x < 63) c = [120, 116, 110];
    const cx = Math.floor((x - 2) / 9), cy = Math.floor((y - 20) / 8);
    if (cx === 0 && cy >= 0 && cy <= 3) {
      const lx = (x - 2) % 9 - 4.5, ly = (y - 20) % 8 - 4;
      const r = Math.sqrt(lx * lx + ly * ly);
      if (r > 2.5 && r < 3.8) c = [190, 30, 30];
    }
    return grain(c, x, y, 61, 6);
  } };
  T.drawing = { draw: (g) => {
    g.fillStyle = '#d8d0b8'; g.fillRect(0, 0, 64, 64);
    g.lineWidth = 2;
    g.strokeStyle = '#3050a0'; g.strokeRect(10, 14, 22, 16); // house
    g.beginPath(); g.moveTo(8, 14); g.lineTo(21, 5); g.lineTo(34, 14); g.stroke();
    g.strokeStyle = '#a07030'; g.beginPath(); g.ellipse(46, 27, 6, 3, 0, 0, 7); g.stroke(); // dog
    g.strokeStyle = '#402010'; g.beginPath(); g.moveTo(0, 34); g.lineTo(64, 34); g.stroke();
    g.strokeStyle = '#181818'; g.lineWidth = 2; // tall man
    g.beginPath(); g.moveTo(21, 38); g.lineTo(21, 56); g.moveTo(21, 44); g.lineTo(12, 60); g.moveTo(21, 44); g.lineTo(30, 60);
    g.moveTo(21, 56); g.lineTo(17, 63); g.moveTo(21, 56); g.lineTo(25, 63); g.stroke();
    g.beginPath(); g.arc(21, 38, 4, 0, 7); g.stroke();
    g.strokeStyle = '#b01010'; g.beginPath(); g.arc(21, 37, 6, 0.2, Math.PI - 0.2); g.stroke();
  } };
  T.ledger = { px: (x, y) => {
    let c = [196, 184, 150];
    if (x > 30 && x < 34) c = [120, 100, 70];
    if (y % 5 === 0 && y > 6 && y < 58 && ((x > 4 && x < 28) || (x > 36 && x < 60))) c = [90, 80, 90];
    if (x > 36 && x < 60 && Math.abs(y - 30 - Math.sin(x * 0.9) * 3) < 1) c = [40, 20, 20];
    if (x < 2 || x > 61) c = [70, 30, 24];
    return grain(c, x, y, 62, 8);
  } };
  T.sign0 = { draw: (g) => {
    g.fillStyle = '#6a5020'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#b89848'; g.fillRect(3, 3, 58, 58);
    g.fillStyle = '#2a1e10'; g.font = 'bold 15px monospace'; g.textAlign = 'center';
    g.fillText('ROOM', 32, 26); g.font = 'bold 26px monospace'; g.fillText('0', 32, 54);
  } };
  T.mailbox = { draw: (g) => {
    g.fillStyle = '#4a4c50'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#d8d0c0'; g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.fillText('MARROW', 32, 38);
  } };
  T.gravetext = { draw: (g) => {
    g.fillStyle = '#5a4030'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2a1a10'; g.font = 'bold 12px monospace'; g.textAlign = 'center';
    g.fillText('GOOD', 32, 26); g.fillText('BOY', 32, 42);
  } };
  T.battery = { px: (x, y) => {
    let c = [30, 30, 30];
    if (y < 12) c = [150, 120, 60];
    if (y > 24 && y < 40) c = [180, 40, 30];
    return grain(c, x, y, 63, 8);
  } };
  T.brass = { px: (x, y) => grain(mix([110, 80, 30], [200, 160, 80], fbm(641, x, y, 4, 2)), x, y, 64, 14) };
  T.lampglass = { px: (x, y) => grain(mix([255, 180, 90], [255, 230, 170], 1 - Math.abs(y - 32) / 32), x, y, 65, 8) };
  T.bulb = { px: () => [255, 236, 190] };
  T.headlight = { px: () => [255, 250, 220] };
  T.white = { px: () => [255, 255, 255] };
  T.black = { px: (x, y) => grain([12, 12, 12], x, y, 66, 6) };
  T.water = { px: (x, y) => {
    let c = [8, 10, 10];
    if (Math.sin(x * 0.3 + Math.sin(y * 0.2) * 2) > 0.95) c = [40, 46, 44];
    return c;
  } };
  T.jar = { px: (x, y) => {
    let c = mix([70, 60, 26], [110, 90, 40], fbm(671, x, y, 4, 3));
    if (y < 10) c = [120, 110, 90];
    if (x > 8 && x < 14 && y > 14) c = mix(c, [200, 200, 170], 0.5);
    if (fbm(672, x, y, 8, 2) > 0.65 && y > 20) c = [40, 50, 30];
    return grain(c, x, y, 67, 10);
  } };
  T.bone = { px: (x, y) => grime(grain([196, 186, 160], x, y, 68, 12), x, y, 681, 0.4) };
  T.plate = { px: (x, y) => {
    const dx = x - 31.5, dy = y - 31.5, r = Math.sqrt(dx * dx + dy * dy);
    if (r > 31) return [0, 0, 0, 0];
    let c = [206, 204, 196];
    if (r > 27) c = [150, 150, 170];
    if (r < 20) c = mix([70, 60, 30], [40, 60, 30], fbm(691, x, y, 4, 3));
    return grain(c, x, y, 69, 10).concat(255);
  } };
  T.plateclean = { px: (x, y) => {
    const dx = x - 31.5, dy = y - 31.5, r = Math.sqrt(dx * dx + dy * dy);
    if (r > 31) return [0, 0, 0, 0];
    let c = [200, 198, 188];
    if (r > 27) c = [140, 140, 160];
    return grime(grain(c, x, y, 70, 10), x, y, 701, 0.3).concat(255);
  } };

  // ---------- nature ----------
  T.pine = { px: (x, y) => {
    let inside = false, snowy = false;
    if (y > 54 && Math.abs(x - 32) < 3) return grain([40, 30, 24], x, y, 71, 10).concat(255);
    for (let k = 0; k < 5; k++) {
      const apex = 1 + k * 10, base = apex + 17;
      if (y < apex || y > base) continue;
      const hw = (8 + k * 5.5) * (y - apex) / (base - apex) + (fbm(711 + k, x, y, 8, 2) - 0.5) * 6;
      if (Math.abs(x - 32) < hw) {
        inside = true;
        const hwUp = (8 + k * 5.5) * (y - 2 - apex) / (base - apex);
        if (Math.abs(x - 32) >= hwUp - 1 || y - apex < 3) snowy = true;
      }
    }
    if (!inside) return [0, 0, 0, 0];
    let c = snowy && h2(x, y, 72) > 0.25 ? [150, 156, 172] : mix([16, 30, 22], [34, 52, 38], fbm(713, x, y, 8, 2));
    return grain(c, x, y, 73, 10).concat(255);
  } };
  T.bark = { px: (x, y) => {
    let c = mix([36, 28, 22], [70, 56, 44], fbm(741, x * 3, y * 0.3, 4, 3));
    if (Math.sin(x * 0.9 + fbm(742, x, y, 4) * 6) > 0.7) c = [24, 18, 14];
    return grain(c, x, y, 74, 12);
  } };
  T.fence = { px: (x, y) => {
    const lx = x % 16;
    const picket = lx > 3 && lx < 12 && y > 4 + (lx === 4 || lx === 11 ? 3 : 0);
    const rail = (y > 16 && y < 22) || (y > 46 && y < 52);
    if (!picket && !rail) return [0, 0, 0, 0];
    let c = mul([110, 104, 94], 0.8 + h2(Math.floor(x / 16), 0, 75) * 0.3);
    if (y < 10 && picket) c = [170, 176, 190];
    return grime(grain(c, x, y, 75, 12), x, y, 751, 0.4).concat(255);
  } };
  T.weeds = { draw: (g) => {
    const r = MH.seeded(76);
    g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = 4 + r() * 56, h = 20 + r() * 40, lean = (r() - 0.5) * 20;
      g.strokeStyle = `rgb(${90 + r() * 50},${76 + r() * 40},${50 + r() * 20})`;
      g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h); g.stroke();
    }
  } };
  T.cobweb = { draw: (g) => {
    g.strokeStyle = 'rgba(200,200,200,1)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const a = i / 6 * Math.PI / 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 64, Math.sin(a) * 64); g.stroke();
    }
    for (let r = 10; r < 64; r += 11) {
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI / 2); g.stroke();
    }
  } };
  T.footprint = { px: (x, y) => {
    const dx = (x - 32) / 9, dy1 = (y - 22) / 16, dy2 = (y - 48) / 9;
    if (dx * dx + dy1 * dy1 < 1 || dx * dx + dy2 * dy2 < 1) return [110, 116, 136, 255];
    return [0, 0, 0, 0];
  } };
  T.pawprint = { px: (x, y) => {
    const pad = ((x - 32) / 11) ** 2 + ((y - 40) / 9) ** 2 < 1;
    let toe = false;
    for (const [tx, ty] of [[18, 22], [28, 15], [38, 15], [47, 22]]) if (((x - tx) / 5) ** 2 + ((y - ty) / 6) ** 2 < 1) toe = true;
    return pad || toe ? [100, 106, 128, 255] : [0, 0, 0, 0];
  } };

  // ---------- creatures ----------
  T.skin = { px: (x, y) => {
    let c = mix([150, 144, 134], [196, 190, 176], fbm(771, x, y, 4, 4));
    const v = Math.abs(x - 30 - 10 * Math.sin(y * 0.1) - fbm(772, x, y, 4) * 14);
    if (v < 0.8) c = [110, 116, 134];
    const v2 = Math.abs(y - 20 - 8 * Math.sin(x * 0.13) - fbm(773, x, y, 4) * 10);
    if (v2 < 0.7) c = [120, 120, 136];
    return grain(c, x, y, 77, 10);
  } };
  T.face = { px: (x, y) => {
    let c = mix([160, 154, 142], [200, 194, 180], fbm(781, x, y, 4, 4));
    const eye = (ex) => ((x - ex) / 6) ** 2 + ((y - 20) / 8) ** 2;
    if (eye(20) < 1 || eye(44) < 1) c = mix([4, 2, 2], [40, 30, 30], Math.min(eye(20), eye(44)) * 0.4);
    // long vertical mouth
    const mw = 7 * Math.sin(Math.max(0, Math.min(1, (y - 30) / 33)) * Math.PI);
    if (y > 30 && Math.abs(x - 32) < mw) {
      c = [18, 4, 6];
      const lx = Math.abs(x - 32);
      if (lx > mw - 2 && (y % 4 < 2)) c = [210, 200, 170];
    }
    return grain(c, x, y, 78, 8);
  } };
  T.suit = { px: (x, y) => {
    let c = [34, 32, 30];
    if (x % 8 === 0) c = [44, 42, 40];
    const t = fbm(791, x, y, 4, 3);
    if (t > 0.7) c = mix([150, 144, 134], [90, 80, 70], 0.5);
    return grime(grain(c, x, y, 79, 8), x, y, 792, 0.3);
  } };
  T.fur = { px: (x, y) => {
    let c = mix([140, 96, 46], [184, 136, 70], h2(x, Math.floor(y / 3), 80));
    c = mul(c, 0.85 + 0.2 * fbm(801, x, y, 4, 2));
    return c;
  } };
  T.furlight = { px: (x, y) => mix([180, 146, 96], [214, 186, 136], h2(x, Math.floor(y / 3), 81)) };
  T.mannequin = { px: (x, y) => {
    let c = [164, 146, 118];
    if (x === 32 || y === 20) c = [110, 96, 76];
    return grime(grain(c, x, y, 82, 8), x, y, 821, 0.45);
  } };
  T.burlap = { px: (x, y) => {
    let c = ((x + y) % 2) ? [140, 114, 78] : [120, 96, 64];
    return grime(grain(c, x, y, 83, 14), x, y, 831, 0.4);
  } };
  T.burlapface = { px: (x, y) => {
    let c = ((x + y) % 2) ? [140, 114, 78] : [120, 96, 64];
    const X = (cx, cy) => Math.abs(Math.abs(x - cx) - Math.abs(y - cy)) < 1.2 && Math.abs(x - cx) < 6;
    if (X(20, 24) || X(44, 24)) c = [20, 16, 12];
    if (y > 40 && y < 44 && x > 14 && x < 50 && x % 4 < 2) c = [20, 16, 12];
    if (Math.abs(y - (42 - Math.sin((x - 14) / 36 * Math.PI) * 4)) < 1 && x > 14 && x < 50) c = [20, 16, 12];
    return grain(c, x, y, 84, 10);
  } };
  T.carpaint = { px: (x, y) => grime(grain(mix([70, 18, 20], [110, 30, 30], fbm(851, x, y, 4, 2)), x, y, 85, 8), x, y, 852, 0.3) };
  T.carglass = { px: (x, y) => {
    let c = [18, 22, 30];
    if (Math.abs(x - y * 0.8 - 12) < 4) c = [60, 70, 90];
    if (y > 50) c = [150, 156, 172];
    return grain(c, x, y, 86, 6);
  } };
  T.rubber = { px: (x, y) => grain([22, 22, 22], x, y, 87, 8) };
  T.redcloth = { px: (x, y) => grain([140, 20, 24], x, y, 88, 12) };
  T.scratches = { px: (x, y) => {
    for (let k = 0; k < 4; k++) {
      const cx = 14 + k * 11 + Math.sin(y * 0.1) * 2;
      if (Math.abs(x - cx - (y - 32) * 0.15) < 1.3 && y > 6 + k * 3 && y < 58 - k * 2) return [150, 124, 96, 255];
    }
    return [0, 0, 0, 0];
  } };
  T.chain = { px: (x, y) => {
    const lx = x % 12, ly = y;
    if (Math.abs(lx - 6) > 5) return [0, 0, 0, 0];
    const link = Math.floor(ly / 10) % 2;
    const inner = link ? Math.abs(lx - 6) < 2 && ly % 10 > 2 && ly % 10 < 8 : Math.abs(lx - 6) > 1;
    if (inner) return [0, 0, 0, 0];
    return grain([110, 110, 114], x, y, 89, 20).concat(255);
  } };

  function build() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS; canvas.height = ATLAS;
    const ctx = canvas.getContext('2d');
    const tiles = {};
    let slot = 0;
    const tmp = document.createElement('canvas');
    tmp.width = SZ; tmp.height = SZ;
    const tctx = tmp.getContext('2d');
    for (const name of Object.keys(T)) {
      const gen = T[name];
      const sx = (slot % PER) * SZ, sy = Math.floor(slot / PER) * SZ;
      if (gen.px) {
        const img = ctx.createImageData(SZ, SZ);
        for (let y = 0; y < SZ; y++) {
          for (let x = 0; x < SZ; x++) {
            const c = gen.px(x, y);
            const o = (y * SZ + x) * 4;
            img.data[o] = MH.clamp(c[0], 0, 255);
            img.data[o + 1] = MH.clamp(c[1], 0, 255);
            img.data[o + 2] = MH.clamp(c[2], 0, 255);
            img.data[o + 3] = c.length > 3 ? c[3] : 255;
          }
        }
        ctx.putImageData(img, sx, sy);
      } else {
        tctx.clearRect(0, 0, SZ, SZ);
        gen.draw(tctx);
        const img = tctx.getImageData(0, 0, SZ, SZ);
        for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 100 ? 255 : 0;
        ctx.putImageData(img, sx, sy);
      }
      tiles[name] = [sx / ATLAS, sy / ATLAS, SZ / ATLAS, SZ / ATLAS];
      slot++;
    }
    return { canvas, tiles, count: slot };
  }

  MH.buildAtlas = build;
})(window.MH);
