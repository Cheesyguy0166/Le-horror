'use strict';
// Marrow House - tile levels: geometry, doors, collision, sight lines, path finding.
(function (MH) {
  const S = MH.TILE;
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  class Heap {
    constructor() { this.a = []; }
    push(n, p) {
      const a = this.a;
      a.push([p, n]);
      let i = a.length - 1;
      while (i > 0) {
        const pa = (i - 1) >> 1;
        if (a[pa][0] <= a[i][0]) break;
        [a[pa], a[i]] = [a[i], a[pa]];
        i = pa;
      }
    }
    pop() {
      const a = this.a;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < a.length && a[l][0] < a[m][0]) m = l;
          if (r < a.length && a[r][0] < a[m][0]) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top[1];
    }
    get size() { return this.a.length; }
  }

  class Level {
    constructor(def, R, atlas) {
      this.def = def;
      this.R = R;
      this.tx = atlas.tiles;
      this.grid = typeof def.grid === 'function' ? def.grid() : def.grid;
      this.W = this.grid[0].length;
      this.H = this.grid.length;
      for (let j = 0; j < this.H; j++) {
        if (this.grid[j].length !== this.W) console.error(`Map ${def.id}: row ${j} has length ${this.grid[j].length}, expected ${this.W}`);
      }
      this.legendCache = {};
      this.cells = new Array(this.W * this.H);
      this.markers = {};
      this.doors = [];
      this.doorAt = new Map();
      this.fenceBoxes = new Map();
      this.propBoxes = new Map();
      this.block = new Uint8Array(this.W * this.H);
      this.lights = [];
      this.fixtures = [];
      for (let j = 0; j < this.H; j++) {
        for (let i = 0; i < this.W; i++) {
          const ch = this.grid[j][i];
          const d = this.resolve(ch);
          this.cells[j * this.W + i] = { ch, d };
          (this.markers[ch] = this.markers[ch] || []).push({ i, j, x: MH.tw(i), z: MH.tw(j) });
        }
      }
      const mb = new MH.MeshBuilder();
      this.mb = mb;
      this._buildTiles(mb);
      for (const p of def.props || []) MH.Props.build(this, mb, p);
      mb.resetTransform();
      this.mesh = R.createMesh(mb.data());
      this.mb = null;
      for (const L of def.lights || []) this.addLight(L);
    }

    resolve(ch) {
      if (this.legendCache[ch]) return this.legendCache[ch];
      const lg = this.def.legend;
      let d = lg[ch];
      if (!d) {
        console.warn(`Map ${this.def.id}: unknown tile '${ch}'`);
        d = { solid: true };
      }
      if (d.like) d = Object.assign({}, this.resolve(d.like), d, { like: undefined });
      this.legendCache[ch] = d;
      return d;
    }

    cell(i, j) {
      if (i < 0 || j < 0 || i >= this.W || j >= this.H) return null;
      return this.cells[j * this.W + i];
    }
    cellAt(x, z) { return this.cell(Math.floor(x / S), Math.floor(z / S)); }
    marker(ch, k) {
      const m = this.markers[ch];
      if (!m) { console.warn('no marker ' + ch); return { i: 1, j: 1, x: MH.tw(1), z: MH.tw(1) }; }
      return m[k || 0];
    }
    tex(name) {
      const t = this.tx[name];
      if (!t) { console.warn('missing texture ' + name); return this.tx.white; }
      return t;
    }

    _opaque(c) { return !c || (c.d.solid && !c.d.tree && !c.d.fence); }

    _buildTiles(mb) {
      const rnd = MH.seeded(this.def.seed || 1234);
      for (let j = 0; j < this.H; j++) {
        for (let i = 0; i < this.W; i++) {
          const c = this.cell(i, j), d = c.d;
          const x0 = i * S, z0 = j * S, x1 = x0 + S, z1 = z0 + S;
          if (d.tree || d.fence || !d.solid) {
            if (d.floor) {
              mb.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0],
                [x0 / S, z1 / S, x1 / S, z1 / S, x1 / S, z0 / S, x0 / S, z0 / S], this.tex(d.floor), d.floorCol || [1, 1, 1, 0]);
            }
            if (d.ceil && !d.solid) {
              const h = d.h || 2.7;
              mb.quad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], [0, -1, 0],
                [x0 / S, z0 / S, x1 / S, z0 / S, x1 / S, z1 / S, x0 / S, z1 / S], this.tex(d.ceil), d.ceilCol || [1, 1, 1, 0]);
            }
          }
          if (d.tree) {
            const n = rnd() < 0.55 ? 1 : 2;
            for (let k = 0; k < n; k++) {
              const cx = x0 + S * (0.25 + rnd() * 0.5), cz = z0 + S * (0.25 + rnd() * 0.5);
              const h = 5 + rnd() * 3.5, w = h * 0.55;
              const shade = 0.75 + rnd() * 0.35;
              mb.cross(cx, 0, cz, w, h, this.tex('pine'), [shade, shade, shade, 0], rnd() * 3);
            }
            continue;
          }
          if (d.fence) {
            this._buildFence(mb, i, j);
            continue;
          }
          if (d.solid) {
            for (const [dx, dz] of DIRS4) {
              const n = this.cell(i + dx, j + dz);
              if (!n || this._opaque(n)) continue;
              const nd = n.d;
              const texName = nd.wall && !d.forceWall ? nd.wall : d.wall || nd.wall || 'plaster';
              const h = d.h || nd.h || 2.7;
              this._wallFace(mb, i, j, dx, dz, h, this.tex(texName), d.wallCol || nd.wallCol);
              if (nd.baseboard && !d.forceWall) this._baseboard(mb, i, j, dx, dz);
            }
            if (d.top) {
              const h = d.h || 2.7;
              mb.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0],
                [0, 1, 1, 1, 1, 0, 0, 0], this.tex(d.top));
            }
          } else if (d.door) {
            this._buildDoor(mb, i, j, d);
          }
        }
      }
    }

    _wallFace(mb, i, j, dx, dz, h, tex, col) {
      const x0 = i * S, z0 = j * S;
      let a, b, n;
      if (dx === 1) { a = [x0 + S, z0 + S]; b = [x0 + S, z0]; n = [1, 0, 0]; }
      else if (dx === -1) { a = [x0, z0]; b = [x0, z0 + S]; n = [-1, 0, 0]; }
      else if (dz === 1) { a = [x0, z0 + S]; b = [x0 + S, z0 + S]; n = [0, 0, 1]; }
      else { a = [x0 + S, z0]; b = [x0, z0]; n = [0, 0, -1]; }
      const segs = Math.max(1, Math.ceil(h / 1.5));
      for (let s = 0; s < segs; s++) {
        const y0 = (h * s) / segs, y1 = (h * (s + 1)) / segs;
        mb.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], n,
          [0, -y0 / S, 1, -y0 / S, 1, -y1 / S, 0, -y1 / S], tex, col || [1, 1, 1, 0]);
      }
    }

    _baseboard(mb, i, j, dx, dz) {
      const x0 = i * S, z0 = j * S, o = 0.02, h = 0.14;
      const t = this.tex('darkwood'), c = [0.8, 0.8, 0.8, 0];
      if (dx === 1) mb.quad([x0 + S + o, 0, z0 + S], [x0 + S + o, 0, z0], [x0 + S + o, h, z0], [x0 + S + o, h, z0 + S], [1, 0, 0], [0, 1, 1, 1, 1, 0, 0, 0], t, c);
      else if (dx === -1) mb.quad([x0 - o, 0, z0], [x0 - o, 0, z0 + S], [x0 - o, h, z0 + S], [x0 - o, h, z0], [-1, 0, 0], [0, 1, 1, 1, 1, 0, 0, 0], t, c);
      else if (dz === 1) mb.quad([x0, 0, z0 + S + o], [x0 + S, 0, z0 + S + o], [x0 + S, h, z0 + S + o], [x0, h, z0 + S + o], [0, 0, 1], [0, 1, 1, 1, 1, 0, 0, 0], t, c);
      else mb.quad([x0 + S, 0, z0 - o], [x0, 0, z0 - o], [x0, h, z0 - o], [x0 + S, h, z0 - o], [0, 0, -1], [0, 1, 1, 1, 1, 0, 0, 0], t, c);
    }

    _buildFence(mb, i, j) {
      const isF = (a, b) => { const c = this.cell(a, b); return c && c.d.fence; };
      const x0 = i * S, z0 = j * S, cx = MH.tw(i), cz = MH.tw(j);
      const t = this.tex('fence'), h = 1.15;
      const boxes = [];
      const horiz = isF(i - 1, j) || isF(i + 1, j);
      const vert = isF(i, j - 1) || isF(i, j + 1);
      if (horiz || !vert) {
        mb.quad([x0, 0, cz], [x0 + S, 0, cz], [x0 + S, h, cz], [x0, h, cz], [0, 0, 1], [0, 1, 1, 1, 1, 0, 0, 0], t);
        boxes.push([x0, cz - 0.1, x0 + S, cz + 0.1]);
      }
      if (vert) {
        mb.quad([cx, 0, z0], [cx, 0, z0 + S], [cx, h, z0 + S], [cx, h, z0], [1, 0, 0], [0, 1, 1, 1, 1, 0, 0, 0], t);
        boxes.push([cx - 0.1, z0, cx + 0.1, z0 + S]);
      }
      this.fenceBoxes.set(j * this.W + i, boxes);
    }

    _buildDoor(mb, i, j, d) {
      const left = this.cell(i - 1, j), right = this.cell(i + 1, j);
      const axis = this._opaque(left) && this._opaque(right) ? 'x' : 'z';
      const x0 = i * S, z0 = j * S, h = d.h || 2.7, jw = (S - 1.0) / 2, dh = 2.1;
      const wallT = this.tex(d.wall || 'plaster');
      const trim = this.tex('darkwood');
      const door = {
        i, j, x: MH.tw(i), z: MH.tw(j), axis, open: false, t: 0, dir: 1,
        locked: d.lock || null, tex: d.doorTex || 'door', jambs: [], h: dh,
      };
      if (axis === 'x') {
        mb.box(x0, 0, z0, x0 + jw, h, z0 + S, wallT, null, S);
        mb.box(x0 + S - jw, 0, z0, x0 + S, h, z0 + S, wallT, null, S);
        mb.box(x0 + jw, dh, z0, x0 + S - jw, h, z0 + S, wallT, null, S);
        mb.box(x0 + jw - 0.06, 0, door.z - 0.12, x0 + jw, dh, door.z + 0.12, trim, null, 0);
        mb.box(x0 + S - jw, 0, door.z - 0.12, x0 + S - jw + 0.06, dh, door.z + 0.12, trim, null, 0);
        door.jambs.push([x0, z0, x0 + jw, z0 + S], [x0 + S - jw, z0, x0 + S, z0 + S]);
        door.slabBox = [x0 + jw, door.z - 0.09, x0 + S - jw, door.z + 0.09];
        door.hinge = [x0 + jw, door.z];
      } else {
        mb.box(x0, 0, z0, x0 + S, h, z0 + jw, wallT, null, S);
        mb.box(x0, 0, z0 + S - jw, x0 + S, h, z0 + S, wallT, null, S);
        mb.box(x0, dh, z0 + jw, x0 + S, h, z0 + S - jw, wallT, null, S);
        mb.box(door.x - 0.12, 0, z0 + jw - 0.06, door.x + 0.12, dh, z0 + jw, trim, null, 0);
        mb.box(door.x - 0.12, 0, z0 + S - jw, door.x + 0.12, dh, z0 + S - jw + 0.06, trim, null, 0);
        door.jambs.push([x0, z0, x0 + S, z0 + jw], [x0, z0 + S - jw, x0 + S, z0 + S]);
        door.slabBox = [door.x - 0.09, z0 + jw, door.x + 0.09, z0 + S - jw];
        door.hinge = [door.x, z0 + jw];
      }
      if (d.startOpen) { door.open = true; door.t = 1; }
      this.doors.push(door);
      this.doorAt.set(j * this.W + i, door);
    }

    doorModel(door) {
      const M4 = MH.M4;
      const ang = door.t * (Math.PI / 2) * 0.95 * door.dir;
      if (door.axis === 'x') {
        return M4.chain(M4.trans(door.hinge[0], 0, door.hinge[1]), M4.rotY(ang), M4.trans(0.5, door.h / 2, 0), M4.scale(1.0, door.h, 0.07));
      }
      return M4.chain(M4.trans(door.hinge[0], 0, door.hinge[1]), M4.rotY(ang), M4.trans(0, door.h / 2, 0.5), M4.scale(0.07, door.h, 1.0));
    }

    // Toggle a door. Returns 'locked' | 'opened' | 'closed'
    useDoor(door, fromX, fromZ, force) {
      if (door.locked && !force) return 'locked';
      door.open = !door.open;
      if (door.open) {
        // swing away from whoever opened it
        if (door.axis === 'x') door.dir = fromZ < door.z ? -1 : 1;
        else door.dir = fromX < door.x ? 1 : -1;
      }
      return door.open ? 'opened' : 'closed';
    }

    update(dt) {
      for (const d of this.doors) {
        const target = d.open ? 1 : 0;
        if (d.t !== target) d.t = MH.clamp(d.t + Math.sign(target - d.t) * dt * 2.6, 0, 1);
      }
    }

    // ------------ collision ------------
    addPropBox(box, blockAI) {
      const i0 = Math.floor(box[0] / S), i1 = Math.floor((box[2] - 0.001) / S);
      const j0 = Math.floor(box[1] / S), j1 = Math.floor((box[3] - 0.001) / S);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
          const k = j * this.W + i;
          if (!this.propBoxes.has(k)) this.propBoxes.set(k, []);
          this.propBoxes.get(k).push(box);
          if (blockAI) {
            const cx = MH.tw(i), cz = MH.tw(j);
            const cover = Math.min(box[2], cx + 0.45) - Math.max(box[0], cx - 0.45) > 0.3 &&
              Math.min(box[3], cz + 0.45) - Math.max(box[1], cz - 0.45) > 0.3;
            if (cover) this.block[k] = 1;
          }
        }
      }
    }

    collidersNear(x, z, r) {
      const out = [];
      const seen = new Set();
      const i0 = Math.floor((x - r) / S) - 1, i1 = Math.floor((x + r) / S) + 1;
      const j0 = Math.floor((z - r) / S) - 1, j1 = Math.floor((z + r) / S) + 1;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const c = this.cell(i, j);
          if (!c || (c.d.solid && !c.d.fence)) { out.push([i * S, j * S, i * S + S, j * S + S]); continue; }
          const k = j * this.W + i;
          if (c.d.fence) { for (const b of this.fenceBoxes.get(k) || []) out.push(b); }
          const door = this.doorAt.get(k);
          if (door) {
            out.push(door.jambs[0], door.jambs[1]);
            if (door.t < 0.35) out.push(door.slabBox);
          }
          const pb = this.propBoxes.get(k);
          if (pb) for (const b of pb) if (!seen.has(b)) { seen.add(b); out.push(b); }
        }
      }
      return out;
    }

    // push a circle out of all colliders; returns new [x,z]
    collide(x, z, r) {
      for (let it = 0; it < 3; it++) {
        const boxes = this.collidersNear(x, z, r);
        let moved = false;
        for (const b of boxes) {
          const cx = MH.clamp(x, b[0], b[2]), cz = MH.clamp(z, b[1], b[3]);
          const dx = x - cx, dz = z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 > 1e-9) {
              const d = Math.sqrt(d2);
              x += (dx / d) * (r - d);
              z += (dz / d) * (r - d);
            } else {
              // centre inside box: push along smallest axis
              const pl = x - b[0], pr = b[2] - x, pu = z - b[1], pd = b[3] - z;
              const m = Math.min(pl, pr, pu, pd);
              if (m === pl) x = b[0] - r; else if (m === pr) x = b[2] + r; else if (m === pu) z = b[1] - r; else z = b[3] + r;
            }
            moved = true;
          }
        }
        if (!moved) break;
      }
      return [x, z];
    }

    // ------------ sight ------------
    blocksSight(i, j) {
      const c = this.cell(i, j);
      if (!c) return true;
      if (c.d.solid && !c.d.fence && !c.d.seeThrough) return true;
      const door = this.doorAt.get(j * this.W + i);
      if (door && door.t < 0.5) return true;
      return false;
    }
    los(ax, az, bx, bz) {
      let i = Math.floor(ax / S), j = Math.floor(az / S);
      const ti = Math.floor(bx / S), tj = Math.floor(bz / S);
      const dx = bx - ax, dz = bz - az;
      const si = Math.sign(dx), sj = Math.sign(dz);
      const tdx = dx !== 0 ? Math.abs(S / dx) : Infinity;
      const tdz = dz !== 0 ? Math.abs(S / dz) : Infinity;
      let tmx = dx > 0 ? ((i + 1) * S - ax) / dx : dx < 0 ? (i * S - ax) / dx : Infinity;
      let tmz = dz > 0 ? ((j + 1) * S - az) / dz : dz < 0 ? (j * S - az) / dz : Infinity;
      let n = 0;
      while (!(i === ti && j === tj) && n++ < 400) {
        if (tmx < tmz) { tmx += tdx; i += si; } else { tmz += tdz; j += sj; }
        if (i === ti && j === tj) break;
        if (this.blocksSight(i, j)) return false;
      }
      return true;
    }

    // ------------ path finding ------------
    walkable(i, j, opts) {
      const c = this.cell(i, j);
      if (!c || c.d.solid) return false;
      const k = j * this.W + i;
      if (this.block[k] && !(opts && opts.ignoreBlock)) return false;
      const door = this.doorAt.get(k);
      if (door && door.locked) return false;
      if (door && opts && opts.noDoors && door.t < 0.5) return false;
      return true;
    }
    walkableAt(x, z, opts) { return this.walkable(Math.floor(x / S), Math.floor(z / S), opts); }

    nearestWalkable(i, j, opts) {
      if (this.walkable(i, j, opts)) return [i, j];
      for (let r = 1; r < 6; r++) {
        for (let dj = -r; dj <= r; dj++) {
          for (let di = -r; di <= r; di++) {
            if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
            if (this.walkable(i + di, j + dj, opts)) return [i + di, j + dj];
          }
        }
      }
      return null;
    }

    findPath(sx, sz, tx, tz, opts) {
      const W = this.W;
      const s = this.nearestWalkable(Math.floor(sx / S), Math.floor(sz / S), opts);
      const t = this.nearestWalkable(Math.floor(tx / S), Math.floor(tz / S), opts);
      if (!s || !t) return null;
      const start = s[1] * W + s[0], goal = t[1] * W + t[0];
      if (start === goal) return [[tx, tz]];
      const g = new Map([[start, 0]]);
      const came = new Map();
      const open = new Heap();
      const hfn = (k) => {
        const i = k % W, j = (k / W) | 0;
        const dx = Math.abs(i - t[0]), dz = Math.abs(j - t[1]);
        return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
      };
      open.push(start, hfn(start));
      const closed = new Set();
      let found = false, iter = 0;
      while (open.size && iter++ < 4000) {
        const cur = open.pop();
        if (cur === goal) { found = true; break; }
        if (closed.has(cur)) continue;
        closed.add(cur);
        const ci = cur % W, cj = (cur / W) | 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            if (!di && !dj) continue;
            const ni = ci + di, nj = cj + dj;
            if (!this.walkable(ni, nj, opts)) continue;
            if (di && dj) {
              if (!this.walkable(ci + di, cj, opts) || !this.walkable(ci, cj + dj, opts)) continue;
              if (this.doorAt.has(nj * W + ni) || this.doorAt.has(cur)) continue;
            }
            const nk = nj * W + ni;
            let cost = di && dj ? 1.414 : 1;
            const door = this.doorAt.get(nk);
            if (door && door.t < 0.5) cost += 1.5;
            const ng = g.get(cur) + cost;
            if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
              g.set(nk, ng);
              came.set(nk, cur);
              open.push(nk, ng + hfn(nk));
            }
          }
        }
      }
      if (!found) return null;
      const path = [];
      let k = goal;
      while (k !== start) {
        path.push([MH.tw(k % W), MH.tw((k / W) | 0)]);
        k = came.get(k);
      }
      path.reverse();
      if (this.walkableAt(tx, tz, opts)) path[path.length - 1] = [tx, tz];
      return path;
    }

    // is a straight walk from a to b clear for a body of radius r
    clearLine(ax, az, bx, bz, r, opts) {
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) return true;
      const nx = -dz / len, nz = dx / len;
      const steps = Math.ceil(len / 0.3);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = ax + dx * t, z = az + dz * t;
        for (const o of [-r, 0, r]) {
          const px = x + nx * o, pz = z + nz * o;
          const i = Math.floor(px / S), j = Math.floor(pz / S);
          if (!this.walkable(i, j, opts)) return false;
          const door = this.doorAt.get(j * this.W + i);
          if (door && door.t < 0.5) return false;
        }
      }
      return true;
    }

    // ------------ lights ------------
    addLight(L) {
      const x = L.x != null ? L.x : MH.tw(L.at[0]) + (L.off ? L.off[0] : 0);
      const z = L.z != null ? L.z : MH.tw(L.at[1]) + (L.off ? L.off[1] : 0);
      const light = {
        id: L.id, group: L.group, x, y: L.y || 2.3, z, col: L.col || [1, 0.85, 0.6],
        radius: L.radius || 6, base: L.intensity || 1, intensity: L.intensity || 1,
        flicker: L.flicker || 0, on: L.on !== false, bounds: null, phase: Math.random() * 100,
        buzz: !!L.buzz,
      };
      if (!L.global) light.bounds = this.roomBounds(Math.floor(x / S), Math.floor(z / S));
      this.lights.push(light);
      return light;
    }
    roomBounds(i, j) {
      const W = this.W;
      const seen = new Set();
      const q = [[i, j]];
      let i0 = i, i1 = i, j0 = j, j1 = j;
      seen.add(j * W + i);
      while (q.length) {
        const [ci, cj] = q.pop();
        i0 = Math.min(i0, ci); i1 = Math.max(i1, ci); j0 = Math.min(j0, cj); j1 = Math.max(j1, cj);
        if (this.doorAt.has(cj * W + ci) && !(ci === i && cj === j)) continue;
        for (const [dx, dz] of DIRS4) {
          const ni = ci + dx, nj = cj + dz;
          const c = this.cell(ni, nj);
          if (!c || (c.d.solid && !c.d.fence)) continue;
          const k = nj * W + ni;
          if (seen.has(k)) continue;
          seen.add(k);
          q.push([ni, nj]);
        }
        if (seen.size > 600) break;
      }
      return [i0 * S - 0.05, j0 * S - 0.05, (i1 + 1) * S + 0.05, (j1 + 1) * S + 0.05];
    }

    randomWalkable(filter) {
      for (let n = 0; n < 400; n++) {
        const i = (Math.random() * this.W) | 0, j = (Math.random() * this.H) | 0;
        if (!this.walkable(i, j) || this.doorAt.has(j * this.W + i)) continue;
        const x = MH.tw(i), z = MH.tw(j);
        if (!filter || filter(x, z)) return [x, z];
      }
      return null;
    }
  }

  MH.Level = Level;
})(window.MH);
