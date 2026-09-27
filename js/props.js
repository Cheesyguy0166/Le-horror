'use strict';
// Marrow House - static props baked into level geometry. Local space: front faces +z,
// back against a wall at -z. Placement: {type, at:[i,j], wall:'n'|'s'|'e'|'w', off:[dx,dz], rot}
(function (MH) {
  const S = MH.TILE;
  const M4 = MH.M4;

  class PropCtx {
    constructor(L, mb, x, z, rot, y) {
      this.L = L; this.mb = mb; this.x = x; this.z = z; this.y = y || 0;
      const a = (rot || 0) * Math.PI / 2;
      this.c = Math.round(Math.cos(a)); this.s = Math.round(Math.sin(a));
    }
    t(n) { return this.L.tex(n); }
    tx(spec) {
      if (typeof spec === 'string') return this.t(spec);
      const o = {};
      for (const k in spec) o[k] = this.t(spec[k]);
      return o;
    }
    world(lx, lz) { return [this.c * lx + this.s * lz + this.x, -this.s * lx + this.c * lz + this.z]; }
    collider(x0, z0, x1, z1, block) {
      const a = this.world(x0, z0), b = this.world(x1, z1);
      this.L.addPropBox([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], block);
    }
    box(x0, y0, z0, x1, y1, z1, tex, o) {
      o = o || {};
      this.mb.box(x0, y0, z0, x1, y1, z1, this.tx(tex), o.col || null, o.uv || 0, o.skip);
      if (o.collide) this.collider(x0, z0, x1, z1, o.block);
    }
    obox(m, tex, col) { this.mb.obox(m, this.tx(tex), col || null); }
    panel(cx, y0, cz, w, h, tex, col, facing) { this.mb.panel(cx, y0, cz, w, h, this.t(tex), col || null, facing); }
    flat(cx, y, cz, w, d, tex, col, rot) { this.mb.floorQuad(cx, y, cz, w, d, this.t(tex), col || null, rot); }
    cross(cx, y0, cz, w, h, tex, col, rot, flip) { this.mb.cross(cx, y0, cz, w, h, this.t(tex), col || null, rot, flip); }
    quad(p0, p1, p2, p3, n, tex, col, uv) { this.mb.quad(p0, p1, p2, p3, n, uv || [0, 1, 1, 1, 1, 0, 0, 0], this.t(tex), col || null); }
  }

  const OB = (x, y, z, sx, sy, sz, ry, rx, rz) =>
    M4.chain(M4.trans(x, y, z), M4.rotY(ry || 0), M4.rotX(rx || 0), M4.rotZ(rz || 0), M4.scale(sx, sy, sz));

  const P = {};
  const D = {}; // depth for wall alignment

  // ---------------- bedroom ----------------
  D.bed = 2.1;
  P.bed = (c) => {
    const W = 1.5, L = 2.1;
    c.box(-W / 2, 0, -L / 2, W / 2, 0.36, L / 2, 'darkwood', { collide: true, block: true });
    c.box(-W / 2 + 0.05, 0.36, -L / 2 + 0.1, W / 2 - 0.05, 0.55, L / 2 - 0.05, 'sheets');
    c.box(-W / 2 + 0.2, 0.55, -L / 2 + 0.15, W / 2 - 0.2, 0.68, -L / 2 + 0.55, 'sheets');
    c.box(-W / 2 + 0.01, 0.5, -L / 2 + 0.62, W / 2 - 0.01, 0.6, L / 2 - 0.01, 'quilt');
    c.box(-W / 2 + 0.01, 0.1, L / 2 - 0.08, W / 2 - 0.01, 0.6, L / 2 - 0.01, 'quilt');
    c.box(-W / 2, 0, -L / 2 - 0.02, W / 2, 1.25, -L / 2 + 0.08, 'darkwood');
    c.box(-W / 2, 0, L / 2 - 0.02, W / 2, 0.75, L / 2 + 0.06, 'darkwood');
  };
  D.wardrobe = 0.6;
  P.wardrobe = (c) => {
    c.box(-0.65, 0, -0.3, 0.65, 2.1, 0.3, { front: 'wardrobe', side: 'darkwood', top: 'darkwood', bottom: 'darkwood', back: 'darkwood' }, { collide: true });
    c.box(-0.7, 2.1, -0.33, 0.7, 2.2, 0.33, 'darkwood');
  };
  D.nightstand = 0.45;
  P.nightstand = (c) => {
    c.box(-0.25, 0, -0.22, 0.25, 0.6, 0.22, { front: 'drawers', side: 'darkwood', top: 'darkwood' }, { collide: true });
  };
  D.dresser = 0.5;
  P.dresser = (c) => {
    c.box(-0.6, 0, -0.25, 0.6, 0.9, 0.25, { front: 'drawers', side: 'darkwood', top: 'darkwood' }, { collide: true });
    c.box(-0.45, 0.9, -0.25, 0.45, 1.8, -0.2, 'darkwood');
    c.panel(0, 1.0, -0.19, 0.75, 0.7, 'water', [1.4, 1.4, 1.5, 0.05]);
  };

  // ---------------- living room ----------------
  D.armchair = 0.9;
  P.armchair = (c) => {
    c.box(-0.45, 0, -0.4, 0.45, 0.42, 0.45, 'fabric', { collide: true, block: false });
    c.box(-0.45, 0.42, -0.45, 0.45, 1.15, -0.25, 'fabric');
    c.box(-0.45, 0.42, -0.25, -0.33, 0.68, 0.45, 'fabric');
    c.box(0.33, 0.42, -0.25, 0.45, 0.68, 0.45, 'fabric');
  };
  D.sofa = 0.9;
  P.sofa = (c) => {
    c.box(-1.0, 0, -0.4, 1.0, 0.42, 0.45, 'fabric', { collide: true });
    c.box(-1.0, 0.42, -0.45, 1.0, 1.0, -0.25, 'fabric');
    c.box(-1.0, 0.42, -0.25, -0.86, 0.65, 0.45, 'fabric');
    c.box(0.86, 0.42, -0.25, 1.0, 0.65, 0.45, 'fabric');
  };
  D.tv = 0.55;
  P.tv = (c) => {
    c.box(-0.5, 0, -0.27, 0.5, 0.5, 0.27, { front: 'drawers', side: 'darkwood', top: 'darkwood' }, { collide: true });
    c.box(-0.38, 0.5, -0.25, 0.38, 1.05, 0.22, 'metaldark');
    c.panel(0, 0.56, 0.225, 0.6, 0.44, 'tvoff');
    c.box(-0.02, 1.05, -0.05, 0.02, 1.35, -0.02, 'metaldark');
  };
  D.fireplace = 0.6;
  P.fireplace = (c) => {
    c.box(-0.9, 0, -0.3, -0.45, 1.2, 0.3, 'brick', { collide: true });
    c.box(0.45, 0, -0.3, 0.9, 1.2, 0.3, 'brick', { collide: true });
    c.box(-0.45, 0.85, -0.3, 0.45, 1.2, 0.3, 'brick');
    c.box(-0.45, 0, -0.3, 0.45, 0.85, -0.2, 'hearth');
    c.flat(0, 0.01, 0.05, 0.9, 0.5, 'hearth');
    c.box(-1.0, 1.2, -0.35, 1.0, 1.3, 0.38, 'darkwood');
    c.box(-0.45, 0, 0.3, 0.45, 0.06, 0.7, 'brick');
    c.collider(-0.45, -0.3, 0.45, 0.1, false);
    // ash and logs
    c.obox(OB(-0.1, 0.08, -0.05, 0.6, 0.12, 0.12, 0.3), 'bark');
    c.obox(OB(0.1, 0.1, 0.05, 0.5, 0.1, 0.1, -0.4), 'hearth');
  };
  D.bookshelf = 0.35;
  P.bookshelf = (c) => {
    c.box(-0.6, 0, -0.18, 0.6, 2.0, 0.18, { front: 'books', side: 'darkwood', top: 'darkwood' }, { collide: true });
  };
  D.clock = 0.4;
  P.clock = (c) => {
    c.box(-0.25, 0, -0.2, 0.25, 2.05, 0.2, 'darkwood', { collide: true });
    c.box(-0.3, 2.05, -0.22, 0.3, 2.2, 0.22, 'darkwood');
    c.panel(0, 1.45, 0.205, 0.42, 0.42, 'clockface');
    c.panel(0, 0.5, 0.205, 0.26, 0.8, 'water', [1.2, 1.1, 0.9, 0]);
    c.box(-0.05, 0.6, 0.18, 0.05, 0.7, 0.2, 'brass');
  };
  D.coatrack = 0.4;
  P.coatrack = (c) => {
    c.box(-0.03, 0, -0.03, 0.03, 1.8, 0.03, 'darkwood', { collide: true });
    c.box(-0.25, 0, -0.03, 0.25, 0.05, 0.03, 'darkwood');
    c.box(-0.03, 0, -0.25, 0.03, 0.05, 0.25, 'darkwood');
    c.box(-0.22, 0.75, -0.12, 0.22, 1.72, 0.1, 'suit', { col: [1.0, 0.8, 0.8] });
    c.box(-0.16, 1.72, -0.1, 0.16, 1.8, 0.08, 'suit');
  };
  D.table = 0;
  P.table = (c, p) => {
    const w = (p.w || 1.4) / 2, d = (p.d || 0.9) / 2, h = p.h || 0.76;
    c.box(-w, h - 0.05, -d, w, h, d, p.tex || 'darkwood', { collide: true, block: p.block !== false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      c.box(sx * (w - 0.08) - 0.03, 0, sz * (d - 0.08) - 0.03, sx * (w - 0.08) + 0.03, h - 0.05, sz * (d - 0.08) + 0.03, p.tex || 'darkwood');
    }
  };
  D.chair = 0.5;
  P.chair = (c, p) => {
    const t = p.tex || 'darkwood';
    c.box(-0.22, 0.42, -0.22, 0.22, 0.47, 0.22, t, { collide: !p.nocollide });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.box(sx * 0.19 - 0.02, 0, sz * 0.19 - 0.02, sx * 0.19 + 0.02, 0.42, sz * 0.19 + 0.02, t);
    c.box(-0.22, 0.47, -0.24, 0.22, 0.95, -0.2, t);
  };
  D.rug = 0;
  P.rug = (c, p) => { c.flat(0, 0.012, 0, p.w || 2.4, p.d || 1.8, p.tex || 'rug'); };
  D.wallpanel = 0.02;
  P.wallpanel = (c, p) => {
    c.panel(0, p.y0 != null ? p.y0 : 1.1, -0.005, p.w || 0.6, p.h || 0.7, p.tex, p.col);
    if (p.frame) {
      const w = (p.w || 0.6) / 2, y0 = p.y0 != null ? p.y0 : 1.1, h = p.h || 0.7;
      c.box(-w - 0.05, y0 - 0.05, -0.02, w + 0.05, y0, 0.02, p.frame);
      c.box(-w - 0.05, y0 + h, -0.02, w + 0.05, y0 + h + 0.05, 0.02, p.frame);
      c.box(-w - 0.05, y0, -0.02, -w, y0 + h, 0.02, p.frame);
      c.box(w, y0, -0.02, w + 0.05, y0 + h, 0.02, p.frame);
    }
  };
  D.window = 0.02;
  P.window = (c, p) => {
    const w = p.w || 1.0, h = p.h || 1.2, y0 = p.y0 || 0.95;
    c.panel(0, y0, -0.005, w, h, 'window', [0.9, 0.95, 1.1, 0.35]);
    c.box(-w / 2 - 0.08, y0 - 0.1, -0.02, w / 2 + 0.08, y0 - 0.02, 0.1, 'lightwood');
  };

  // ---------------- kitchen ----------------
  D.counter = 0.6;
  P.counter = (c, p) => {
    const w = (p.w || 1.5) / 2;
    c.box(-w, 0, -0.3, w, 0.86, 0.28, { front: 'cabinet', side: 'darkwood', top: 'darkwood' }, { collide: true });
    c.box(-w, 0.86, -0.3, w, 0.92, 0.3, 'counter', { uv: 0.8 });
    if (p.upper !== false) c.box(-w, 1.5, -0.3, w, 2.2, 0.05, { front: 'cabinet', side: 'darkwood', top: 'darkwood', bottom: 'darkwood' });
    if (p.sink) {
      c.box(-0.35, 0.921, -0.18, 0.35, 0.925, 0.2, 'metaldark');
      c.box(-0.03, 0.92, -0.28, 0.03, 1.2, -0.22, 'metalwhite');
      c.box(-0.03, 1.15, -0.28, 0.03, 1.2, -0.08, 'metalwhite');
    }
  };
  D.stove = 0.65;
  P.stove = (c) => {
    c.box(-0.4, 0, -0.32, 0.4, 0.9, 0.32, 'metalwhite', { collide: true });
    c.box(-0.4, 0.9, -0.32, 0.4, 0.92, 0.32, 'metaldark');
    c.panel(0, 0.2, 0.325, 0.55, 0.4, 'tvoff');
    for (const [x, z] of [[-0.18, -0.14], [0.18, -0.14], [-0.18, 0.14], [0.18, 0.14]]) c.flat(x, 0.925, z, 0.2, 0.2, 'black');
    c.box(-0.4, 0.92, -0.32, 0.4, 1.15, -0.28, 'metalwhite');
    // a pot left on the stove
    c.box(-0.3, 0.925, 0.02, -0.06, 1.1, 0.26, 'metaldark');
  };
  D.fridge = 0.7;
  P.fridge = (c) => {
    c.box(-0.4, 0, -0.35, 0.4, 1.8, 0.35, 'metalwhite', { collide: true });
    c.box(-0.4, 1.2, 0.35, 0.4, 1.21, 0.36, 'metaldark');
    c.box(0.3, 0.7, 0.35, 0.34, 1.1, 0.4, 'metaldark');
    c.box(0.3, 1.3, 0.35, 0.34, 1.6, 0.4, 'metaldark');
  };
  D.plates = 0.4;
  P.plates = (c, p) => {
    const rnd = MH.seeded(p.seed || 7);
    const stacks = p.n || 3;
    for (let k = 0; k < stacks; k++) {
      const x = (k - (stacks - 1) / 2) * 0.32 + (rnd() - 0.5) * 0.06, z = (rnd() - 0.5) * 0.1;
      const cnt = 1 + Math.floor(rnd() * (p.tall || 4));
      for (let q = 0; q < cnt; q++) {
        const y = q * 0.025;
        c.box(x - 0.13, y, z - 0.13, x + 0.13, y + 0.02, z + 0.13, { top: q === cnt - 1 ? (p.clean ? 'plateclean' : 'plate') : 'plateclean', side: 'white', bottom: 'white' }, { col: [0.9, 0.9, 0.85] });
      }
    }
  };

  // ---------------- bathroom ----------------
  D.bathtub = 0.8;
  P.bathtub = (c) => {
    c.box(-0.4, 0, -0.85, 0.4, 0.55, 0.85, 'metalwhite', { collide: true, block: true, skip: ['top'] });
    c.box(-0.4, 0.5, -0.85, 0.4, 0.58, -0.75, 'metalwhite');
    c.box(-0.4, 0.5, 0.75, 0.4, 0.58, 0.85, 'metalwhite');
    c.box(-0.4, 0.5, -0.75, -0.32, 0.58, 0.75, 'metalwhite');
    c.box(0.32, 0.5, -0.75, 0.4, 0.58, 0.75, 'metalwhite');
    c.flat(0, 0.48, 0, 0.64, 1.5, 'water');
  };
  D.toilet = 0.7;
  P.toilet = (c) => {
    c.box(-0.2, 0, -0.1, 0.2, 0.4, 0.3, 'metalwhite', { collide: true });
    c.box(-0.25, 0.3, -0.35, 0.25, 0.8, -0.12, 'metalwhite');
    c.box(-0.21, 0.4, -0.1, 0.21, 0.43, 0.32, 'metalwhite');
  };
  D.psink = 0.5;
  P.psink = (c) => {
    c.box(-0.08, 0, -0.2, 0.08, 0.8, -0.05, 'metalwhite', { collide: true });
    c.box(-0.3, 0.8, -0.25, 0.3, 0.92, 0.2, 'metalwhite');
    c.panel(0, 1.2, -0.24, 0.5, 0.6, 'water', [1.5, 1.5, 1.6, 0.04]);
  };

  // ---------------- study / misc ----------------
  D.desk = 0.7;
  P.desk = (c) => {
    c.box(-0.7, 0.72, -0.35, 0.7, 0.78, 0.35, 'darkwood', { collide: true, block: false });
    c.box(0.25, 0, -0.33, 0.68, 0.72, 0.33, { front: 'drawers', side: 'darkwood', top: 'darkwood' });
    c.box(-0.68, 0, -0.33, -0.62, 0.72, 0.33, 'darkwood');
  };
  D.shelf = 0.4;
  P.shelf = (c, p) => {
    const w = (p.w || 1.4) / 2, rnd = MH.seeded(p.seed || 3);
    c.box(-w, 0, -0.2, -w + 0.04, 2.0, 0.2, 'lightwood', { collide: true });
    c.box(w - 0.04, 0, -0.2, w, 2.0, 0.2, 'lightwood');
    c.collider(-w, -0.2, w, 0.2);
    for (let k = 0; k < 4; k++) {
      const y = 0.1 + k * 0.5;
      c.box(-w, y, -0.2, w, y + 0.03, 0.2, 'lightwood');
      let x = -w + 0.1;
      while (x < w - 0.15) {
        if (rnd() < 0.75) {
          const s = 0.08 + rnd() * 0.05, hh = 0.15 + rnd() * 0.12;
          c.box(x, y + 0.03, -0.1, x + s, y + 0.03 + hh, -0.1 + s, p.item || 'jar');
        }
        x += 0.16 + rnd() * 0.08;
      }
    }
  };
  D.crate = 0;
  P.crate = (c, p) => {
    const s = (p.s || 0.9) / 2, h = p.h || s * 2;
    c.box(-s, 0, -s, s, h, s, 'crate', { collide: true, block: p.block !== false });
    if (p.stack) c.box(-s * 0.8, h, -s * 0.8, s * 0.7, h + s * 1.4, s * 0.8, 'crate');
  };
  D.trunk = 0.6;
  P.trunk = (c) => {
    c.box(-0.5, 0, -0.3, 0.5, 0.55, 0.3, 'darkwood', { collide: true });
    c.box(-0.52, 0.2, -0.32, 0.52, 0.26, 0.32, 'brass');
    c.box(-0.52, 0.45, -0.32, 0.52, 0.5, 0.32, 'brass');
    c.box(-0.5, 0.55, -0.3, 0.5, 0.6, 0.3, 'darkwood');
  };
  D.rockinghorse = 0;
  P.rockinghorse = (c) => {
    c.obox(OB(0, 0.1, 0, 0.1, 0.06, 1.1, 0, 0, 0), 'lightwood');
    c.box(-0.2, 0.1, -0.35, 0.2, 0.14, 0.35, 'lightwood', { collide: true });
    for (const [x, z] of [[-0.12, -0.3], [0.12, -0.3], [-0.12, 0.3], [0.12, 0.3]]) c.box(x - 0.03, 0.12, z - 0.03, x + 0.03, 0.5, z + 0.03, 'lightwood');
    c.box(-0.12, 0.5, -0.35, 0.12, 0.72, 0.35, 'lightwood');
    c.obox(OB(0, 0.85, 0.38, 0.14, 0.4, 0.14, 0, 0.5), 'lightwood');
    c.box(-0.08, 0.9, 0.4, 0.08, 1.05, 0.65, 'lightwood');
    c.box(-0.02, 0.7, -0.45, 0.02, 0.9, -0.35, 'burlap');
  };
  D.crib = 0.7;
  P.crib = (c) => {
    c.box(-0.65, 0, -0.35, 0.65, 0.35, 0.35, 'lightwood', { collide: true });
    for (let k = 0; k <= 12; k++) {
      const x = -0.62 + k * 0.103;
      c.box(x, 0.35, -0.35, x + 0.03, 1.0, -0.32, 'lightwood');
      c.box(x, 0.35, 0.32, x + 0.03, 1.0, 0.35, 'lightwood');
    }
    c.box(-0.65, 1.0, -0.36, 0.65, 1.05, -0.3, 'lightwood');
    c.box(-0.65, 1.0, 0.3, 0.65, 1.05, 0.36, 'lightwood');
    c.box(-0.6, 0.35, -0.3, 0.6, 0.42, 0.3, 'sheets');
  };
  D.rafter = 0;
  P.rafter = (c, p) => {
    const l = (p.len || 10) / 2, y = p.y || 2.0;
    c.box(-l, y, -0.08, l, y + 0.2, 0.08, 'darkwood');
  };
  D.cobweb = 0;
  P.cobweb = (c, p) => {
    const s = p.s || 0.8, y = p.y || 2.0;
    c.quad([-s / 2, y, -s / 2], [s / 2, y, s / 2], [s / 2, y - s, s / 2], [-s / 2, y - s, -s / 2], [0.7, 0, -0.7], 'cobweb', [0.9, 0.9, 0.9, 0.1], [0, 0, 1, 0, 1, 1, 0, 1]);
  };
  D.ladder = 0;
  P.ladder = (c, p) => {
    const h = p.h || 2.7, run = 1.1;
    const ang = Math.atan2(run, h), len = Math.hypot(run, h);
    for (const x of [-0.25, 0.25]) c.obox(OB(x, h / 2, -run / 2 + 0.1, 0.06, len, 0.06, 0, -ang), 'lightwood');
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      c.box(-0.25, h * t - 0.02, -run * (1 - t) + 0.1 - 0.03, 0.25, h * t + 0.02, -run * (1 - t) + 0.1 + 0.03, 'lightwood');
    }
    c.flat(0, h - 0.005, -run / 2 + 0.1, 0.8, run + 0.3, 'black');
  };
  D.stairsup = 0;
  P.stairsup = (c) => {
    for (let k = 0; k < 5; k++) {
      const z1 = 0.75 - k * 0.3, y1 = 0.25 * (k + 1);
      c.box(-0.75, 0, z1 - 0.3, 0.75, y1, z1, { top: 'woodfloor', side: 'darkwood', front: 'darkwood' }, { uv: 0 });
    }
    c.collider(-0.75, -0.75, 0.75, 0.15, false);
  };

  // ---------------- barn / yard ----------------
  D.haybale = 0;
  P.haybale = (c, p) => {
    const w = (p.w || 1.2) / 2, d = (p.d || 0.6) / 2;
    c.box(-w, 0, -d, w, 0.55, d, 'hay', { collide: true, block: p.block });
    if (p.stack) c.box(-w + 0.1, 0.55, -d, w - 0.05, 1.1, d, 'hay');
  };
  D.workbench = 0.7;
  P.workbench = (c) => {
    c.box(-0.9, 0.85, -0.35, 0.9, 0.95, 0.35, 'lightwood', { collide: true });
    for (const x of [-0.85, 0.8]) c.box(x, 0, -0.3, x + 0.06, 0.85, 0.3, 'lightwood');
    c.box(-0.9, 0.95, -0.35, 0.9, 1.9, -0.32, 'barnwood');
    c.box(-0.5, 0.95, -0.2, -0.2, 1.05, 0.1, 'metaldark');
    c.obox(OB(0.4, 1.4, -0.29, 0.04, 0.9, 0.02, 0, 0, 0.3), 'metaldark');
  };
  D.car = 0;
  P.car = (c) => {
    c.box(-0.9, 0.3, -2.2, 0.9, 1.0, 2.2, { side: 'carpaint', top: 'carpaint', front: 'carpaint', back: 'carpaint' }, { collide: true, block: true });
    c.box(-0.8, 1.0, -1.0, 0.8, 1.55, 1.1, 'carpaint');
    c.panel(0, 1.02, -1.005, 1.5, 0.5, 'carglass', null, 2);
    c.panel(0, 1.02, 1.105, 1.5, 0.5, 'carglass', null, 0);
    c.panel(0.805, 1.02, 0.05, 1.9, 0.48, 'carglass', null, 1);
    c.panel(-0.805, 1.02, 0.05, 1.9, 0.48, 'carglass', null, 3);
    c.flat(0, 1.02, -1.6, 1.7, 1.15, 'roofsnow');
    c.flat(0, 1.56, 0.05, 1.55, 2.0, 'roofsnow');
    c.panel(-0.6, 0.62, -2.205, 0.35, 0.2, 'headlight', [1, 1, 1, 1.5], 2);
    c.panel(0.6, 0.62, -2.205, 0.35, 0.2, 'headlight', [1, 1, 1, 1.5], 2);
    c.panel(-0.65, 0.65, 2.205, 0.3, 0.15, 'redcloth', [1, 0.3, 0.3, 0.8], 0);
    c.panel(0.65, 0.65, 2.205, 0.3, 0.15, 'redcloth', [1, 0.3, 0.3, 0.8], 0);
    for (const [x, z] of [[-0.85, -1.4], [0.85, -1.4], [-0.85, 1.4], [0.85, 1.4]]) c.box(x - 0.12, 0, z - 0.35, x + 0.12, 0.6, z + 0.35, 'rubber');
  };
  D.porch = 0;
  P.porch = (c, p) => {
    const w = (p.w || 6) / 2, d = p.d || 2.6, h = p.h || 2.7;
    c.box(-w, 0, 0, w, 0.12, d, 'porchwood', { uv: 1.5 });
    for (const x of [-w + 0.1, -1.0, 1.0, w - 0.1]) {
      c.box(x - 0.08, 0, d - 0.18, x + 0.08, h, d - 0.02, 'lightwood', { collide: true });
    }
    c.obox(M4.chain(M4.trans(0, h + 0.2, d / 2), M4.rotX(-0.25), M4.scale(w * 2 + 0.4, 0.12, d + 0.5)), 'roofsnow');
    c.box(-w, h - 0.1, d - 0.2, w, h + 0.05, d, 'lightwood');
    c.box(-1.0, 0, d, 1.0, 0.08, d + 0.4, 'porchwood', { uv: 1.5 });
    // railings
    for (const [x0, x1] of [[-w, -1.0], [1.0, w]]) {
      c.box(x0, 0.85, d - 0.12, x1, 0.92, d - 0.06, 'lightwood', { collide: true });
      for (let x = x0 + 0.15; x < x1; x += 0.25) c.box(x - 0.02, 0.1, d - 0.11, x + 0.02, 0.85, d - 0.07, 'lightwood');
    }
  };
  D.roof = 0;
  P.roof = (c, p) => {
    // gable roof: ridge along local x. w (x extent), d (z extent), y0 eave height, rise
    const w = p.w / 2, d = p.d / 2, y0 = p.y0, r = p.rise || 2.5, o = 0.4;
    const t = p.tex || 'roofsnow';
    const s = (d + o) / 2.5;
    c.quad([-w - o, y0 - 0.3, d + o], [w + o, y0 - 0.3, d + o], [w + o, y0 + r, 0], [-w - o, y0 + r, 0], [0, 0.8, 0.6], t, null, [0, s, (2 * w) / 2.5, s, (2 * w) / 2.5, 0, 0, 0]);
    c.quad([w + o, y0 - 0.3, -d - o], [-w - o, y0 - 0.3, -d - o], [-w - o, y0 + r, 0], [w + o, y0 + r, 0], [0, 0.8, -0.6], t, null, [0, s, (2 * w) / 2.5, s, (2 * w) / 2.5, 0, 0, 0]);
    const g = p.gable || 'siding';
    for (const sx of [-1, 1]) {
      const x = sx * w;
      c.quad([x, y0, -d], [x, y0, d], [x, y0 + r * (d / (d + o)) * 1.0, 0], [x, y0 + r * (d / (d + o)), 0], [sx, 0, 0], g, null, [0, 1, 1, 1, 0.5, 0, 0.5, 0]);
    }
  };
  D.appletree = 0;
  P.appletree = (c) => {
    c.box(-0.22, 0, -0.22, 0.22, 2.4, 0.22, 'bark', { collide: true, block: true });
    const br = [[0.4, 2.3, 0.1, 1.9, 0.7, 0.9], [-0.5, 2.2, -0.2, 1.7, -0.9, 0.8], [0.1, 2.6, 0.5, 1.6, 0.1, -0.9], [-0.2, 2.8, -0.4, 1.5, 2.5, -0.7],
      [0.6, 1.7, -0.3, 1.2, -2.2, 1.1], [-0.3, 3.1, 0.2, 1.3, 1.2, 0.3]];
    for (const [x, y, z, l, ry, rz] of br) c.obox(M4.chain(M4.trans(x, y, z), M4.rotY(ry), M4.rotZ(rz), M4.scale(0.12, l, 0.12)), 'bark');
    const tw = [[1.2, 3.0, 0.3, 0.9, 0.3, 1.2], [-1.1, 2.9, -0.5, 0.8, 2.0, -1.2], [0.4, 3.4, 1.0, 0.9, -1.2, -0.8], [-0.6, 3.6, 0.8, 0.8, 1.0, 0.6]];
    for (const [x, y, z, l, ry, rz] of tw) c.obox(M4.chain(M4.trans(x, y, z), M4.rotY(ry), M4.rotZ(rz), M4.scale(0.06, l, 0.06)), 'bark');
    // birdhouse facing +z
    c.box(-0.14, 1.5, 0.22, 0.14, 1.8, 0.46, 'lightwood');
    c.obox(M4.chain(M4.trans(0, 1.86, 0.34), M4.rotZ(0.6), M4.scale(0.22, 0.03, 0.32)), 'darkwood');
    c.obox(M4.chain(M4.trans(0, 1.86, 0.34), M4.rotZ(-0.6), M4.scale(0.22, 0.03, 0.32)), 'darkwood');
    c.panel(0, 1.6, 0.465, 0.08, 0.08, 'black');
  };
  D.grave = 0;
  P.grave = (c) => {
    c.box(-0.35, 0, -0.6, 0.35, 0.18, 0.6, 'snow', { uv: 1 });
    c.box(-0.04, 0, -0.66, 0.04, 0.75, -0.58, 'darkwood', { collide: true });
    c.box(-0.22, 0.48, -0.66, 0.22, 0.56, -0.58, 'darkwood');
    c.panel(0, 0.25, -0.575, 0.16, 0.18, 'gravetext');
  };
  D.well = 0;
  P.well = (c) => {
    c.box(-0.7, 0, -0.7, 0.7, 0.8, -0.55, 'stone', { uv: 1 });
    c.box(-0.7, 0, 0.55, 0.7, 0.8, 0.7, 'stone', { uv: 1 });
    c.box(-0.7, 0, -0.55, -0.55, 0.8, 0.55, 'stone', { uv: 1 });
    c.box(0.55, 0, -0.55, 0.7, 0.8, 0.55, 'stone', { uv: 1 });
    c.flat(0, 0.3, 0, 1.1, 1.1, 'black');
    c.collider(-0.7, -0.7, 0.7, 0.7, true);
    c.box(-0.7, 0.8, -0.05, -0.6, 2.0, 0.05, 'darkwood');
    c.box(0.6, 0.8, -0.05, 0.7, 2.0, 0.05, 'darkwood');
    c.box(-0.7, 1.7, -0.04, 0.7, 1.78, 0.04, 'darkwood');
    c.obox(M4.chain(M4.trans(0, 2.1, 0.3), M4.rotX(0.6), M4.scale(1.6, 0.04, 0.8)), 'roofsnow');
    c.obox(M4.chain(M4.trans(0, 2.1, -0.3), M4.rotX(-0.6), M4.scale(1.6, 0.04, 0.8)), 'roofsnow');
    c.box(-0.01, 1.0, -0.01, 0.01, 1.7, 0.01, 'rubber');
  };
  D.woodpile = 0.7;
  P.woodpile = (c, p) => {
    const w = (p.w || 2) / 2;
    c.collider(-w, -0.35, w, 0.35, true);
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 6; k++) {
        const x = -w + 0.18 + k * ((w * 2 - 0.36) / 5), y = 0.12 + row * 0.22;
        c.obox(OB(x + (row % 2) * 0.08, y, 0, 0.2, 0.2, 0.7), 'bark');
      }
    }
    c.box(-w, 0.98, -0.36, w, 1.02, 0.36, 'snow', { uv: 1 });
  };
  D.scarecrow = 0;
  P.scarecrow = (c) => {
    c.box(-0.05, 0, -0.05, 0.05, 2.2, 0.05, 'darkwood', { collide: true });
    c.box(-0.8, 1.55, -0.04, 0.8, 1.63, 0.04, 'darkwood');
    c.box(-0.25, 0.9, -0.14, 0.25, 1.65, 0.14, 'suit');
    c.box(-0.7, 1.45, -0.1, -0.25, 1.65, 0.1, 'suit');
    c.box(0.25, 1.45, -0.1, 0.7, 1.65, 0.1, 'suit');
    c.box(-0.16, 1.65, -0.14, 0.16, 2.0, 0.14, 'burlap');
    c.panel(0, 1.66, 0.145, 0.3, 0.32, 'burlapface');
    c.box(-0.2, 2.0, -0.18, 0.2, 2.03, 0.18, 'black');
    c.box(-0.13, 2.03, -0.12, 0.13, 2.2, 0.12, 'black');
  };
  D.clothesline = 0;
  P.clothesline = (c, p) => {
    const l = (p.len || 5) / 2;
    for (const x of [-l, l]) {
      c.box(x - 0.05, 0, -0.05, x + 0.05, 2.0, 0.05, 'darkwood', { collide: true });
      c.box(x - 0.05, 1.9, -0.4, x + 0.05, 1.96, 0.4, 'darkwood');
    }
    for (const z of [-0.35, 0.35]) c.box(-l, 1.9, z - 0.005, l, 1.91, z + 0.005, 'white');
    const rnd = MH.seeded(p.seed || 9);
    for (let k = 0; k < 4; k++) {
      const x = -l + 0.6 + k * ((l * 2 - 1.2) / 3), z = k % 2 ? 0.35 : -0.35;
      const w = 0.7 + rnd() * 0.3, h = 0.9 + rnd() * 0.4;
      c.quad([x - w / 2, 1.9 - h, z], [x + w / 2, 1.9 - h, z], [x + w / 2, 1.9, z], [x - w / 2, 1.9, z], [0, 0, 1], k === 2 ? 'quilt' : 'sheets');
    }
  };
  D.mailbox = 0;
  P.mailbox = (c) => {
    c.box(-0.04, 0, -0.04, 0.04, 1.1, 0.04, 'darkwood', { collide: true });
    c.box(-0.14, 1.1, -0.28, 0.14, 1.35, 0.28, { side: 'mailbox', top: 'roofsnow', front: 'metaldark', back: 'metaldark' });
    c.box(0.14, 1.2, 0.1, 0.16, 1.45, 0.14, 'redcloth');
  };
  D.log = 0;
  P.log = (c, p) => {
    const l = p.len || 6;
    c.obox(M4.chain(M4.trans(0, 0.4, 0), M4.rotY(p.ang || 0), M4.scale(l, 0.7, 0.7)), 'bark');
    c.collider(-l / 2, -0.5, l / 2, 0.5, true);
  };
  D.weeds = 0;
  P.weeds = (c, p) => {
    const rnd = MH.seeded(p.seed || 11);
    for (let k = 0; k < (p.n || 3); k++) {
      c.cross((rnd() - 0.5) * 1.0, 0, (rnd() - 0.5) * 1.0, 0.8 + rnd() * 0.6, 0.5 + rnd() * 0.5, 'weeds', [0.9, 0.9, 0.9, 0], rnd() * 3);
    }
  };
  D.lamphook = 0.3;
  P.lamphook = (c) => {
    c.box(-0.08, 0, -0.08, 0.08, 2.4, 0.08, 'barnwood', { collide: true });
    c.box(-0.03, 1.9, 0.08, 0.03, 1.95, 0.35, 'metaldark');
  };

  // ---------------- cellar ----------------
  D.barrel = 0;
  P.barrel = (c) => {
    c.box(-0.3, 0, -0.3, 0.3, 0.9, 0.3, 'darkwood', { collide: true });
    c.box(-0.32, 0.15, -0.32, 0.32, 0.2, 0.32, 'iron');
    c.box(-0.32, 0.7, -0.32, 0.32, 0.75, 0.32, 'iron');
  };
  D.bones = 0;
  P.bones = (c, p) => {
    const rnd = MH.seeded(p.seed || 13);
    for (let k = 0; k < (p.n || 7); k++) {
      c.obox(OB((rnd() - 0.5) * 1.1, 0.03, (rnd() - 0.5) * 1.1, 0.05, 0.05, 0.25 + rnd() * 0.25, rnd() * 6, 0, 0), 'bone');
    }
  };
  D.platepile = 0;
  P.platepile = (c, p) => {
    const rnd = MH.seeded(p.seed || 17);
    c.collider(-0.6, -0.6, 0.6, 0.6, true);
    for (let s = 0; s < (p.n || 5); s++) {
      const x = (rnd() - 0.5) * 0.9, z = (rnd() - 0.5) * 0.9, h = 0.3 + rnd() * (p.tall || 1.6);
      const lean = (rnd() - 0.5) * 0.15;
      c.obox(M4.chain(M4.trans(x, h / 2, z), M4.rotZ(lean), M4.scale(0.27, h, 0.27)), { top: 'plateclean', side: 'plateclean' }, [0.85, 0.83, 0.78]);
    }
  };
  D.roots = 0;
  P.roots = (c, p) => {
    const h = p.h || 2.4;
    c.cross(0, h - 1.2, 0, 1.2, 1.2, 'weeds', [0.45, 0.35, 0.28, 0], p.rot || 0.4, true);
  };
  D.lodgerbed = 0;
  P.lodgerbed = (c) => {
    const L = 2.8, W = 1.0;
    c.box(-W / 2, 0.35, -L / 2, W / 2, 0.42, L / 2, 'iron', { collide: true, block: true });
    for (const [x, z] of [[-W / 2, -L / 2], [W / 2, -L / 2], [-W / 2, L / 2], [W / 2, L / 2]]) c.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.42, z + 0.03, 'iron');
    c.box(-W / 2, 0, -L / 2 - 0.02, W / 2, 1.1, -L / 2 + 0.03, 'iron');
    c.box(-W / 2 + 0.03, 0.42, -L / 2 + 0.05, W / 2 - 0.03, 0.56, L / 2 - 0.05, 'mattress');
    c.box(-0.2, 0.56, -0.9, 0.2, 0.58, 0.9, 'black');
  };

  MH.Props = {
    build(L, mb, p) {
      const fn = P[p.type];
      if (!fn) { console.warn('unknown prop ' + p.type); return; }
      let x = p.x != null ? p.x : MH.tw(p.at[0]);
      let z = p.z != null ? p.z : MH.tw(p.at[1]);
      let rot = p.rot || 0;
      if (p.wall) {
        rot = { n: 0, w: 1, s: 2, e: 3 }[p.wall];
        const push = S / 2 - (p.depth != null ? p.depth : D[p.type] || 0) / 2 - 0.02;
        if (p.wall === 'n') z -= push;
        else if (p.wall === 's') z += push;
        else if (p.wall === 'w') x -= push;
        else x += push;
      }
      if (p.off) { x += p.off[0]; z += p.off[1]; }
      mb.setTransform(x, p.y || 0, z, rot);
      fn(new PropCtx(L, mb, x, z, rot, p.y || 0), p);
      mb.resetTransform();
    },
    depth: D,
  };
})(window.MH);
