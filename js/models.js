'use strict';
// Marrow House - boxy articulated models (PS1 style) and small item meshes.
// Models face -z in local space (matching camera yaw convention).
(function (MH) {
  const M4 = MH.M4;

  class Rig {
    // parts: [{name, parent, pos, size, off, tex, tint}]
    constructor(parts) {
      this.parts = parts;
      this.idx = {};
      parts.forEach((p, i) => {
        this.idx[p.name] = i;
        p.pi = p.parent ? this.idx[p.parent] : -1;
        p.r = [0, 0, 0];
        p.s = [1, 1, 1];
        p.hidden = false;
      });
      this.mats = new Array(parts.length);
    }
    set(name, rx, ry, rz) {
      const p = this.parts[this.idx[name]];
      p.r[0] = rx || 0; p.r[1] = ry || 0; p.r[2] = rz || 0;
    }
    get(name) { return this.parts[this.idx[name]]; }
    compute(root) {
      const piv = new Array(this.parts.length);
      this.parts.forEach((p, i) => {
        const base = p.pi >= 0 ? piv[p.pi] : root;
        piv[i] = M4.chain(base, M4.trans(p.pos[0], p.pos[1], p.pos[2]), M4.rotY(p.r[1]), M4.rotX(p.r[0]), M4.rotZ(p.r[2]));
        const o = p.off || [0, 0, 0];
        this.mats[i] = M4.chain(piv[i], M4.trans(o[0], o[1], o[2]), M4.scale(p.size[0] * p.s[0], p.size[1] * p.s[1], p.size[2] * p.s[2]));
      });
      this.pivots = piv;
    }
    // world position of a part's pivot
    pivotPos(name) {
      const m = this.pivots[this.idx[name]];
      return [m[12], m[13], m[14]];
    }
    draw(R, cube, tiles, tintAll) {
      this.parts.forEach((p, i) => {
        if (p.hidden) return;
        let t = p.tint || [1, 1, 1, 0];
        if (tintAll) t = [t[0] * tintAll[0], t[1] * tintAll[1], t[2] * tintAll[2], (t[3] || 0) + (tintAll[3] || 0)];
        R.draw(cube, this.mats[i], t, tiles[p.tex]);
      });
    }
  }

  function lodgerRig() {
    const P = [];
    const add = (name, parent, pos, size, off, tex, tint) => P.push({ name, parent, pos, size, off, tex, tint });
    add('hips', null, [0, 1.22, 0], [0.32, 0.18, 0.18], [0, 0, 0], 'suit');
    add('torso', 'hips', [0, 0.08, 0], [0.36, 0.66, 0.2], [0, 0.33, 0], 'suit');
    add('neck', 'torso', [0, 0.66, -0.02], [0.07, 0.28, 0.07], [0, 0.14, 0], 'skin');
    add('head', 'neck', [0, 0.27, 0], [0.19, 0.33, 0.21], [0, 0.15, -0.01], 'skin');
    add('face', 'head', [0, 0, 0], [0.18, 0.32, 0.01], [0, 0.15, -0.121], 'face');
    add('jaw', 'head', [0, -0.01, 0.02], [0.13, 0.13, 0.15], [0, -0.06, -0.06], 'skin');
    add('maw', 'head', [0, 0.0, 0], [0.11, 0.04, 0.12], [0, -0.03, -0.04], 'black');
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      add('uarm' + n, 'torso', [s * 0.21, 0.62, 0], [0.08, 0.6, 0.08], [0, -0.29, 0], 'suit');
      add('farm' + n, 'uarm' + n, [0, -0.58, 0], [0.06, 0.66, 0.06], [0, -0.32, 0], 'skin');
      add('hand' + n, 'farm' + n, [0, -0.64, 0], [0.1, 0.14, 0.04], [0, -0.06, 0], 'skin');
      for (let f = 0; f < 3; f++) add('fing' + n + f, 'hand' + n, [(f - 1) * 0.034, -0.12, 0], [0.017, 0.3, 0.017], [0, -0.14, 0], 'skin');
      add('thigh' + n, 'hips', [s * 0.1, -0.05, 0], [0.1, 0.6, 0.1], [0, -0.29, 0], 'suit');
      add('shin' + n, 'thigh' + n, [0, -0.58, 0], [0.075, 0.6, 0.075], [0, -0.29, 0], 'skin');
      add('foot' + n, 'shin' + n, [0, -0.57, 0], [0.09, 0.05, 0.3], [0, -0.01, -0.1], 'skin');
    }
    return new Rig(P);
  }

  function dogRig() {
    const P = [];
    const add = (name, parent, pos, size, off, tex, tint) => P.push({ name, parent, pos, size, off, tex, tint });
    add('body', null, [0, 0.42, 0], [0.26, 0.24, 0.6], [0, 0, 0], 'fur');
    add('neck', 'body', [0, 0.06, -0.26], [0.15, 0.2, 0.15], [0, 0.08, -0.03], 'fur');
    add('collar', 'neck', [0, 0.02, -0.02], [0.17, 0.05, 0.17], [0, 0, 0], 'redcloth');
    add('head', 'neck', [0, 0.17, -0.05], [0.2, 0.18, 0.21], [0, 0.02, -0.05], 'fur');
    add('snout', 'head', [0, -0.02, -0.15], [0.11, 0.09, 0.14], [0, 0, -0.04], 'furlight');
    add('nose', 'snout', [0, 0.03, -0.11], [0.05, 0.04, 0.03], [0, 0, 0], 'black');
    add('earL', 'head', [-0.075, 0.1, 0.0], [0.055, 0.11, 0.03], [0, 0.05, 0], 'fur');
    add('earR', 'head', [0.075, 0.1, 0.0], [0.055, 0.11, 0.03], [0, 0.05, 0], 'fur');
    add('eyeL', 'head', [-0.055, 0.045, -0.155], [0.035, 0.03, 0.01], [0, 0, 0], 'black', [1, 1, 1, 0.9]);
    add('eyeR', 'head', [0.055, 0.045, -0.155], [0.035, 0.03, 0.01], [0, 0, 0], 'black', [1, 1, 1, 0.9]);
    add('legFL', 'body', [-0.085, -0.06, -0.22], [0.07, 0.37, 0.07], [0, -0.16, 0], 'fur');
    add('legFR', 'body', [0.085, -0.06, -0.22], [0.07, 0.37, 0.07], [0, -0.16, 0], 'fur');
    add('legBL', 'body', [-0.085, -0.06, 0.23], [0.075, 0.37, 0.075], [0, -0.16, 0], 'fur');
    add('legBR', 'body', [0.085, -0.06, 0.23], [0.075, 0.37, 0.075], [0, -0.16, 0], 'fur');
    add('tail', 'body', [0, 0.08, 0.29], [0.05, 0.05, 0.32], [0, 0, 0.14], 'fur');
    return new Rig(P);
  }

  function dressformRig(covered) {
    const P = [];
    const add = (name, parent, pos, size, off, tex, tint) => P.push({ name, parent, pos, size, off, tex, tint });
    const skin = [0.78, 0.74, 0.7, 0];
    add('base', null, [0, 0.02, 0], [0.42, 0.03, 0.06], [0, 0, 0], 'darkwood');
    add('base2', 'base', [0, 0, 0], [0.06, 0.03, 0.42], [0, 0, 0], 'darkwood');
    add('pole', 'base', [0, 0, 0], [0.035, 0.9, 0.035], [0, 0.45, 0], 'darkwood');
    add('hip', 'pole', [0, 0.88, 0], [0.34, 0.22, 0.25], [0, 0.11, 0], 'mannequin', skin);
    add('waist', 'hip', [0, 0.22, 0], [0.23, 0.16, 0.18], [0, 0.08, 0], 'mannequin', skin);
    add('bust', 'waist', [0, 0.16, 0], [0.37, 0.26, 0.24], [0, 0.13, 0], 'mannequin', skin);
    add('shoulders', 'bust', [0, 0.26, 0], [0.44, 0.07, 0.19], [0, 0.03, 0], 'mannequin', skin);
    add('neckcap', 'shoulders', [0, 0.07, 0], [0.09, 0.1, 0.09], [0, 0.05, 0], 'darkwood');
    add('knob', 'neckcap', [0, 0.1, 0], [0.05, 0.05, 0.05], [0, 0.02, 0], 'brass');
    if (covered) {
      const sh = [0.8, 0.78, 0.74, 0];
      add('sheet', 'pole', [0, 0.72, 0], [0.54, 1.0, 0.4], [0, 0.5, 0], 'sheets', sh);
      add('hood', 'sheet', [0, 1.0, 0], [0.26, 0.22, 0.26], [0, 0.1, 0], 'sheets', sh);
      add('hem', 'pole', [0, 0.62, 0], [0.62, 0.12, 0.46], [0, 0.06, 0], 'sheets', sh);
    }
    return new Rig(P);
  }

  // ---------------- animation ----------------
  function animateLodger(rig, st) {
    const t = st.t, ph = st.phase, mode = st.mode;
    const run = mode === 'run', walk = mode === 'walk' || run;
    const lean = st.lean != null ? st.lean : run ? 0.7 : walk ? 0.38 : 0.3;
    const sw = run ? 0.75 : 0.45;
    const legA = walk ? Math.sin(ph) * sw : 0, legB = walk ? Math.sin(ph + Math.PI) * sw : 0;
    rig.get('hips').pos[1] = 1.22 - (walk ? Math.abs(Math.sin(ph)) * (run ? 0.1 : 0.05) : 0) - (st.crouch || 0);
    rig.set('hips', 0, walk ? Math.sin(ph) * 0.12 : Math.sin(t * 0.7) * 0.05, 0);
    rig.set('torso', lean + (walk ? 0 : Math.sin(t * 1.3) * 0.03), walk ? -Math.sin(ph) * 0.15 : 0, walk ? Math.sin(ph) * 0.06 : Math.sin(t * 0.5) * 0.04);
    rig.set('thighL', legA - (st.crouch || 0) * 1.2, 0, 0.04);
    rig.set('thighR', legB - (st.crouch || 0) * 1.2, 0, -0.04);
    rig.set('shinL', walk ? -Math.max(0, Math.sin(ph + 1.3)) * (run ? 1.4 : 0.8) : -(st.crouch || 0) * 2, 0, 0);
    rig.set('shinR', walk ? -Math.max(0, Math.sin(ph + Math.PI + 1.3)) * (run ? 1.4 : 0.8) : -(st.crouch || 0) * 2, 0, 0);
    rig.set('footL', (st.crouch || 0) * 0.8, 0, 0);
    rig.set('footR', (st.crouch || 0) * 0.8, 0, 0);
    const tw = st.twitch || [0, 0, 0];
    rig.set('neck', -lean * 0.55 + 0.35 + tw[0], tw[1] * 0.4, 0);
    rig.set('head', -0.25 + tw[0] * 0.5, tw[1], 0.25 + tw[2]);
    rig.set('jaw', -(0.12 + (st.jaw || 0) * 0.8 + Math.max(0, Math.sin(t * 9)) * 0.05), 0, 0);
    if (run || mode === 'reach') {
      const r = Math.sin(ph) * 0.3;
      rig.set('uarmL', -1.3 + lean * 0.3 + r, 0.1, 0.15);
      rig.set('uarmR', -1.3 + lean * 0.3 - r, -0.1, -0.15);
      rig.set('farmL', -0.2, 0, 0);
      rig.set('farmR', -0.2, 0, 0);
    } else if (mode === 'stun') {
      rig.set('uarmL', -2.4, 0.3, 0.4);
      rig.set('uarmR', -2.2, -0.3, -0.4);
      rig.set('farmL', -1.2, 0, 0);
      rig.set('farmR', -1.3, 0, 0);
    } else {
      const s = walk ? Math.sin(ph) * 0.28 : Math.sin(t * 1.1) * 0.05;
      rig.set('uarmL', -lean * 0.9 - s, 0, 0.08);
      rig.set('uarmR', -lean * 0.9 + s, 0, -0.08);
      rig.set('farmL', -0.15 + Math.sin(t * 2.1) * 0.03, 0, 0);
      rig.set('farmR', -0.12 + Math.sin(t * 1.7 + 1) * 0.03, 0, 0);
    }
    for (const n of ['L', 'R']) {
      rig.set('hand' + n, 0, 0, 0);
      for (let f = 0; f < 3; f++) {
        const curl = run ? -0.3 : 0.25 + Math.sin(t * 3 + f * 1.7 + (n === 'L' ? 0 : 2)) * 0.25;
        rig.set('fing' + n + f, curl, 0, (f - 1) * (run ? 0.25 : 0.1));
      }
    }
  }

  function animateDog(rig, st) {
    const t = st.t, ph = st.phase, mode = st.mode;
    const moving = mode === 'walk' || mode === 'run';
    const amp = mode === 'run' ? 0.8 : 0.5;
    const a = moving ? Math.sin(ph) * amp : 0, b = moving ? Math.sin(ph + Math.PI) * amp : 0;
    const body = rig.get('body');
    body.pos[1] = 0.42 + (moving ? Math.abs(Math.sin(ph)) * 0.03 : 0);
    let bodyRx = 0;
    if (mode === 'sit') { bodyRx = 0.55; body.pos[1] = 0.34; }
    if (mode === 'lie') { body.pos[1] = 0.17; }
    if (mode === 'dig') { bodyRx = -0.25; }
    rig.set('body', bodyRx, 0, 0);
    if (mode === 'sit') {
      rig.set('legFL', -0.55, 0, 0); rig.set('legFR', -0.55, 0, 0);
      rig.set('legBL', 1.2, 0, 0.1); rig.set('legBR', 1.2, 0, -0.1);
    } else if (mode === 'lie') {
      rig.set('legFL', 1.45, 0, 0); rig.set('legFR', 1.45, 0, 0);
      rig.set('legBL', -1.45, 0, 0); rig.set('legBR', -1.45, 0, 0);
    } else if (mode === 'dig') {
      const d = Math.sin(t * 16) * 0.7;
      rig.set('legFL', 0.4 + d, 0, 0); rig.set('legFR', 0.4 - d, 0, 0);
      rig.set('legBL', -0.1, 0, 0); rig.set('legBR', -0.1, 0, 0);
    } else {
      rig.set('legFL', a, 0, 0); rig.set('legBR', a, 0, 0);
      rig.set('legFR', b, 0, 0); rig.set('legBL', b, 0, 0);
    }
    const happy = st.happy != null ? st.happy : 1;
    const wag = happy > 0.5 ? Math.sin(t * (moving ? 12 : 15)) * 0.7 * happy : Math.sin(t * 3) * 0.05;
    const tailUp = happy > 0.5 ? 0.6 : -0.7;
    rig.set('tail', tailUp - bodyRx * 0.5, wag, 0);
    const look = st.look || 0, lookUp = st.lookUp || 0;
    let neckRx = 0.35 - bodyRx * 0.7;
    if (mode === 'growl') neckRx = -0.25;
    if (mode === 'dig') neckRx = -0.5;
    if (st.bark > 0) neckRx += Math.sin(st.bark * Math.PI) * 0.35;
    rig.set('neck', neckRx, look * 0.5, 0);
    rig.set('head', -0.35 + lookUp, look * 0.5, st.tilt || 0);
    rig.set('earL', mode === 'growl' ? -0.8 : -0.1, 0, -0.2);
    rig.set('earR', mode === 'growl' ? -0.8 : 0.4, 0, 1.25); // the crooked ear
  }

  // ---------------- item meshes ----------------
  function buildItems(R, tiles) {
    const mk = (fn) => {
      const mb = new MH.MeshBuilder();
      fn(mb);
      return R.createMesh(mb.data());
    };
    const T = (n) => tiles[n];
    const items = {};
    items.key = mk((mb) => {
      mb.box(-0.015, 0, -0.07, 0.015, 0.012, 0.04, T('brass'));
      mb.box(-0.035, 0, 0.04, 0.035, 0.012, 0.1, T('brass'));
      mb.box(-0.02, 0, -0.07, 0.0, 0.012, -0.05, T('brass'));
      mb.box(-0.02, 0, -0.035, 0.0, 0.012, -0.02, T('brass'));
    });
    items.battery = mk((mb) => {
      mb.box(-0.02, 0, -0.05, 0.02, 0.04, 0.05, { side: T('battery'), top: T('battery'), front: T('brass'), back: T('black') });
    });
    items.note = mk((mb) => {
      mb.floorQuad(0, 0.005, 0, 0.21, 0.28, T('paper'), [1.1, 1.1, 1.1, 0.12]);
    });
    items.notewall = mk((mb) => {
      mb.panel(0, -0.14, 0, 0.21, 0.28, T('paper'), [1.1, 1.1, 1.1, 0.12], 0);
    });
    items.lamp = mk((mb) => {
      mb.box(-0.07, 0, -0.07, 0.07, 0.07, 0.07, T('metaldark'));
      mb.box(-0.055, 0.07, -0.055, 0.055, 0.2, 0.055, T('lampglass'), [1, 1, 1, 1.4]);
      mb.box(-0.06, 0.2, -0.06, 0.06, 0.24, 0.06, T('metaldark'));
      mb.box(-0.005, 0.24, -0.06, 0.005, 0.3, 0.06, T('metaldark'));
      mb.box(-0.005, 0.3, -0.06, 0.005, 0.31, 0.06, T('metaldark'));
    });
    items.lampdark = mk((mb) => {
      mb.box(-0.07, 0, -0.07, 0.07, 0.07, 0.07, T('metaldark'));
      mb.box(-0.055, 0.07, -0.055, 0.055, 0.2, 0.055, T('carglass'));
      mb.box(-0.06, 0.2, -0.06, 0.06, 0.24, 0.06, T('metaldark'));
      mb.box(-0.005, 0.24, -0.06, 0.005, 0.31, 0.06, T('metaldark'));
    });
    items.bell = mk((mb) => {
      mb.box(-0.02, 0.16, -0.02, 0.02, 0.3, 0.02, T('darkwood'));
      mb.box(-0.04, 0.13, -0.04, 0.04, 0.16, 0.04, T('brass'));
      mb.box(-0.055, 0.07, -0.055, 0.055, 0.13, 0.055, T('brass'));
      mb.box(-0.075, 0.0, -0.075, 0.075, 0.07, 0.075, T('brass'));
    });
    items.bulb = mk((mb) => {
      mb.box(-0.005, -0.3, -0.005, 0.005, 0, 0.005, T('black'));
      mb.box(-0.045, -0.4, -0.045, 0.045, -0.3, 0.045, T('bulb'));
    });
    items.shade = mk((mb) => {
      mb.box(-0.01, -0.35, -0.01, 0.01, 0, 0.01, T('black'));
      mb.box(-0.22, -0.5, -0.22, 0.22, -0.35, 0.22, T('metaldark'), null, 0);
      mb.box(-0.06, -0.55, -0.06, 0.06, -0.47, 0.06, T('bulb'));
    });
    items.phone = mk((mb) => {
      mb.box(-0.1, 0, -0.08, 0.1, 0.07, 0.08, T('black'));
      mb.box(-0.12, 0.07, -0.03, 0.12, 0.1, 0.03, T('black'));
      mb.box(-0.03, 0.071, -0.07, 0.03, 0.072, 0.0, T('clockface'));
    });
    items.handset = mk((mb) => {
      mb.box(-0.12, -0.015, -0.03, 0.12, 0.015, 0.03, T('black'));
    });
    items.musicbox = mk((mb) => {
      mb.box(-0.1, 0, -0.07, 0.1, 0.09, 0.07, T('darkwood'));
      mb.box(-0.1, 0.09, -0.07, 0.1, 0.1, 0.07, T('brass'));
      mb.box(-0.1, 0.1, -0.07, 0.1, 0.22, -0.06, T('water'), [1.5, 1.5, 1.5, 0]);
      mb.box(-0.01, 0.1, -0.01, 0.01, 0.16, 0.01, T('brass'));
      mb.box(-0.015, 0.16, -0.015, 0.015, 0.2, 0.015, T('mannequin'));
    });
    items.photo = mk((mb) => {
      mb.box(-0.06, 0, -0.01, 0.06, 0.12, 0.01, { front: T('photo'), side: T('darkwood'), back: T('darkwood'), top: T('darkwood') });
    });
    items.hat = mk((mb) => {
      mb.box(-0.2, 0, -0.17, 0.2, 0.02, 0.17, T('suit'), [1.5, 1.5, 1.5, 0]);
      mb.box(-0.11, 0.02, -0.1, 0.11, 0.15, 0.1, T('suit'), [1.5, 1.5, 1.5, 0]);
    });
    items.tvscreen = mk((mb) => { mb.panel(0, 0, 0, 0.6, 0.44, T('tvstatic'), [1, 1, 1, 1.2], 0); });
    items.quad = R.createMesh(MH.MeshBuilder.unitQuad());
    items.cube = R.createMesh(MH.MeshBuilder.unitCube());
    items.cellardoor = mk((mb) => { mb.panel(0, 0, 0, 1.05, 2.1, T('cellardoor'), null, 0); });
    items.cellarhole = mk((mb) => {
      mb.panel(0, 0, 0, 1.05, 2.1, T('cellarhole'), null, 0);
      mb.floorQuad(0, 0.01, 0.25, 1.0, 0.5, T('black'));
    });
    items.frontdoor = mk((mb) => { mb.panel(0, 0, 0, 1.05, 2.1, T('frontdoor'), null, 0); });
    items.hatch = mk((mb) => { mb.panel(0, 0, 0, 0.9, 1.2, T('door'), null, 0); });
    items.chainbroken = mk((mb) => {
      mb.panel(-0.3, 0.9, 0.02, 0.1, 0.6, T('chain'), null, 0);
      mb.panel(0.35, 0.7, 0.02, 0.1, 0.5, T('chain'), null, 0);
    });
    items.scratch = mk((mb) => { mb.panel(0, 0, 0, 0.5, 0.7, T('scratches'), null, 0); });
    // pull-down attic ladder, origin at the hatch in the ceiling
    items.ladder = mk((mb) => {
      const top = [0, -0.3], bot = [-2.7, 0.9];
      const len = Math.hypot(top[0] - bot[0], top[1] - bot[1]);
      const ang = -Math.atan2(bot[1] - top[1], top[0] - bot[0]);
      for (const x of [-0.25, 0.25]) {
        mb.obox(M4.chain(M4.trans(x, (top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2), M4.rotX(ang), M4.scale(0.06, len, 0.06)), T('lightwood'));
      }
      for (let k = 1; k < 9; k++) {
        const t = k / 9, y = MH.lerp(top[0], bot[0], t), z = MH.lerp(top[1], bot[1], t);
        mb.box(-0.25, y - 0.02, z - 0.03, 0.25, y + 0.02, z + 0.03, T('lightwood'));
      }
      mb.floorQuad(0, -0.004, 0.25, 0.9, 1.2, T('black'));
      mb.quad([-0.45, -1.2, -0.36], [0.45, -1.2, -0.36], [0.45, 0, -0.36], [-0.45, 0, -0.36], [0, 0, 1], [0, 1, 1, 1, 1, 0, 0, 0], T('door'));
    });
    items.hatch = mk((mb) => {
      mb.floorQuad(0, -0.006, 0.25, 0.9, 1.2, T('door'));
      mb.box(-0.5, -0.05, -0.4, 0.5, -0.002, -0.35, T('darkwood'));
      mb.box(-0.5, -0.05, 0.85, 0.5, -0.002, 0.9, T('darkwood'));
      mb.box(-0.02, -0.12, 0.8, 0.02, -0.006, 0.84, T('rubber'));
    });
    items.hole = mk((mb) => {
      mb.floorQuad(0, 0, 0, 1.0, 1.3, T('black'));
      for (const x of [-0.55, 0.55]) mb.box(x - 0.03, 0, -0.65, x + 0.03, 0.9, -0.59, T('darkwood'));
      mb.box(-0.58, 0.85, -0.65, 0.58, 0.9, -0.59, T('darkwood'));
    });
    items.collar = mk((mb) => {
      const r = T('redcloth');
      mb.box(-0.08, 0, -0.08, 0.08, 0.035, -0.06, r);
      mb.box(-0.08, 0, 0.06, 0.08, 0.035, 0.08, r);
      mb.box(-0.08, 0, -0.06, -0.06, 0.035, 0.06, r);
      mb.box(0.06, 0, -0.06, 0.08, 0.035, 0.06, r);
      mb.box(-0.02, -0.06, 0.08, 0.02, 0.0, 0.09, T('brass'));
    });
    items.pawprint = mk((mb) => { mb.floorQuad(0, 0, 0, 0.13, 0.13, T('pawprint')); });
    items.hookchain = mk((mb) => {
      mb.box(-0.01, -0.5, -0.01, 0.01, 0, 0.01, T('iron'));
      mb.box(-0.01, -0.54, -0.01, 0.01, -0.5, 0.06, T('iron'));
      mb.box(-0.01, -0.54, 0.05, 0.01, -0.46, 0.07, T('iron'));
    });
    return items;
  }

  MH.Models = { Rig, lodgerRig, dogRig, dressformRig, animateLodger, animateDog, buildItems };
})(window.MH);
