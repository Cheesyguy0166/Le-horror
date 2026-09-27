'use strict';
// Marrow House - core helpers, math, noise.
window.MH = window.MH || {};
(function (MH) {
  MH.TILE = 1.5; // metres per map tile

  MH.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  MH.lerp = (a, b, t) => a + (b - a) * t;
  MH.smoothstep = (a, b, x) => {
    const t = MH.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  MH.rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
  MH.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  MH.wrapAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  MH.dist = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
  // yaw facing from a to b. forward(yaw) = (-sin yaw, -cos yaw)
  MH.yawTo = (ax, az, bx, bz) => Math.atan2(-(bx - ax), -(bz - az));
  MH.turnTowards = (cur, target, maxStep) => {
    const d = MH.wrapAngle(target - cur);
    if (Math.abs(d) <= maxStep) return target;
    return cur + Math.sign(d) * maxStep;
  };
  // tile index -> world centre
  MH.tw = (i) => (i + 0.5) * MH.TILE;

  MH.seeded = (seed) => {
    let s = (seed >>> 0) || 0x9e3779b9;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };

  // Tileable value noise
  MH.makeNoise = (seed, period) => {
    const r = MH.seeded(seed);
    const P = period;
    const g = new Float32Array(P * P);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const fx = x - xi, fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const i0 = ((xi % P) + P) % P, i1 = (i0 + 1) % P;
      const j0 = ((yi % P) + P) % P, j1 = (j0 + 1) % P;
      const a = g[j0 * P + i0], b = g[j0 * P + i1], c = g[j1 * P + i0], d = g[j1 * P + i1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  };

  // ---- 4x4 matrices, column-major ----
  const M4 = (MH.M4 = {
    ident() {
      const m = new Float32Array(16);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },
    mul(a, b, o) {
      o = o || new Float32Array(16);
      const r = new Float32Array(16);
      for (let c = 0; c < 4; c++) {
        for (let row = 0; row < 4; row++) {
          r[c * 4 + row] =
            a[row] * b[c * 4] + a[4 + row] * b[c * 4 + 1] + a[8 + row] * b[c * 4 + 2] + a[12 + row] * b[c * 4 + 3];
        }
      }
      o.set(r);
      return o;
    },
    persp(fovy, aspect, n, f) {
      const m = new Float32Array(16);
      const t = 1 / Math.tan(fovy / 2);
      m[0] = t / aspect;
      m[5] = t;
      m[10] = (f + n) / (n - f);
      m[11] = -1;
      m[14] = (2 * f * n) / (n - f);
      return m;
    },
    trans(x, y, z) {
      const m = M4.ident();
      m[12] = x; m[13] = y; m[14] = z;
      return m;
    },
    scale(x, y, z) {
      const m = M4.ident();
      m[0] = x; m[5] = y; m[10] = z;
      return m;
    },
    rotX(a) {
      const c = Math.cos(a), s = Math.sin(a), m = M4.ident();
      m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
      return m;
    },
    rotY(a) {
      const c = Math.cos(a), s = Math.sin(a), m = M4.ident();
      m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
      return m;
    },
    rotZ(a) {
      const c = Math.cos(a), s = Math.sin(a), m = M4.ident();
      m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
      return m;
    },
    // chain multiply: M4.chain(A,B,C) = A*B*C
    chain(...ms) {
      let r = ms[0];
      for (let i = 1; i < ms.length; i++) r = M4.mul(r, ms[i]);
      return r;
    },
    // transform a point
    point(m, x, y, z) {
      return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      ];
    },
  });

  // camera helpers
  MH.forward = (yaw, pitch) => [
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ];
  MH.viewMatrix = (x, y, z, yaw, pitch, roll) =>
    M4.chain(M4.rotZ(-roll || 0), M4.rotX(-pitch), M4.rotY(-yaw), M4.trans(-x, -y, -z));
})(window.MH);
