'use strict';
// Marrow House - entities: interactables, the dog, the Lodger, dress forms, apparitions.
(function (MH) {
  const M4 = MH.M4;
  const dist = MH.dist;

  class Ent {
    constructor(G, o) {
      this.G = G;
      this.alive = true;
      this.x = 0; this.y = 0; this.z = 0; this.yaw = 0;
      Object.assign(this, o || {});
    }
    update() {}
    draw() {}
    destroy() {}
  }

  // Generic interactable / decorative thing.
  // o: {x,y,z,yaw, mesh: string|fn, prompt: string|fn, use(G,t), range, iy, glint, tint, tick(dt,G,t), hidden}
  class Thing extends Ent {
    get interactive() { return !!this.onUse && this.alive && (!this.enabled || this.enabled(this.G, this)); }
    get prompt() { return typeof this.promptText === 'function' ? this.promptText(this.G, this) : this.promptText; }
    use() { if (this.onUse) this.onUse(this.G, this); }
    update(dt) { if (this.tick) this.tick(dt, this.G, this); }
    draw(R) {
      if (this.hidden) return;
      const name = typeof this.mesh === 'function' ? this.mesh(this.G, this) : this.mesh;
      if (!name) return;
      const mesh = this.G.items[name];
      if (!mesh) return;
      let m = M4.chain(M4.trans(this.x, this.y, this.z), M4.rotY(this.yaw || 0));
      if (this.scale) m = M4.mul(m, M4.scale(this.scale, this.scale, this.scale));
      const t = this.tint ? this.tint.slice() : [1, 1, 1, 0];
      const gl = typeof this.glint === 'function' ? this.glint(this.G, this) : this.glint;
      if (gl) t[3] = (t[3] || 0) + 0.18 + 0.18 * Math.sin(this.G.time * 4 + this.x);
      R.draw(mesh, m, t);
    }
    destroy() { if (this.onDestroy) this.onDestroy(this.G, this); }
  }

  class DoorEnt extends Ent {
    constructor(G, door) {
      super(G, { door, x: door.x, y: 1.1, z: door.z, range: 1.8 });
    }
    get interactive() { return true; }
    get prompt() {
      const d = this.door;
      if (d.locked) return d.lockText || 'Locked';
      return d.open ? 'Close door' : 'Open door';
    }
    use() { this.G.useDoor(this.door, this.G.player.x, this.G.player.z, 'player'); }
    draw(R) {
      const G = this.G;
      R.draw(G.items.cube, G.level.doorModel(this.door), [1, 1, 1, 0], G.atlas.tiles[this.door.tex]);
    }
  }

  // ---------------- shared locomotion ----------------
  function steer(ent, tx, tz, speed, dt, opts) {
    const G = ent.G, L = G.level;
    opts = opts || {};
    if (ent.doorWait > 0) { ent.doorWait -= dt; ent.curSpeed = 0; return 'door'; }
    const goalMoved = !ent.goal || dist(ent.goal[0], ent.goal[1], tx, tz) > 0.8;
    if (!ent.path || G.time > ent.repathAt || goalMoved) {
      if (L.clearLine(ent.x, ent.z, tx, tz, ent.r * 0.9)) ent.path = [[tx, tz]];
      else ent.path = L.findPath(ent.x, ent.z, tx, tz, opts.pf);
      ent.goal = [tx, tz];
      ent.repathAt = G.time + (opts.repath || 0.6);
    }
    if (!ent.path || !ent.path.length) { ent.curSpeed = 0; return 'nopath'; }
    while (ent.path.length > 1 && L.clearLine(ent.x, ent.z, ent.path[1][0], ent.path[1][1], ent.r * 0.9)) ent.path.shift();
    let [wx, wz] = ent.path[0];
    let dx = wx - ent.x, dz = wz - ent.z, d = Math.hypot(dx, dz);
    if (d < 0.2) {
      ent.path.shift();
      if (!ent.path.length) { ent.curSpeed = 0; return 'arrived'; }
      [wx, wz] = ent.path[0];
      dx = wx - ent.x; dz = wz - ent.z; d = Math.hypot(dx, dz);
    }
    // door in the way?
    const ahead = 0.9;
    const px = ent.x + (dx / d) * Math.min(ahead, d), pz = ent.z + (dz / d) * Math.min(ahead, d);
    const door = L.doorAt.get(Math.floor(pz / MH.TILE) * L.W + Math.floor(px / MH.TILE));
    if (door && !door.open && opts.opensDoors) {
      if (door.locked) { ent.curSpeed = 0; return 'locked'; }
      G.useDoor(door, ent.x, ent.z, ent.kind);
      ent.doorWait = opts.doorDelay || 0.6;
      ent.curSpeed = 0;
      return 'door';
    }
    const step = Math.min(d, speed * dt);
    const ox = ent.x, oz = ent.z;
    ent.x += (dx / d) * step;
    ent.z += (dz / d) * step;
    [ent.x, ent.z] = L.collide(ent.x, ent.z, ent.r);
    ent.curSpeed = Math.hypot(ent.x - ox, ent.z - oz) / Math.max(dt, 1e-4);
    ent.yaw = MH.turnTowards(ent.yaw, MH.yawTo(0, 0, dx, dz), dt * (opts.turn || 7));
    if (ent.curSpeed < speed * 0.2) {
      ent.stuck = (ent.stuck || 0) + dt;
      if (ent.stuck > 1.2) { ent.path = null; ent.stuck = 0; ent.repathAt = 0; }
    } else ent.stuck = 0;
    return 'moving';
  }

  function inView(G, x, y, z, margin) {
    const c = G.cam;
    const dx = x - c.x, dy = y - c.y, dz = z - c.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const f = MH.forward(c.yaw, c.pitch);
    return (dx * f[0] + dy * f[1] + dz * f[2]) / d > (margin || 0.62);
  }

  // =====================================================================
  // BISCUIT
  // =====================================================================
  class Dog extends Ent {
    constructor(G, o) {
      super(G, o);
      this.kind = 'dog';
      this.rig = MH.Models.dogRig();
      this.r = 0.25;
      this.state = this.state || 'follow';
      this.anim = { t: 0, phase: 0, mode: 'stand', happy: 1, look: 0, lookUp: 0, bark: 0, tilt: 0 };
      this.idle = 0;
      this.saveCd = 0;
      this.hurt = 0;
      this.barkCd = 0;
      this.growlCd = 2;
      this.pantCd = 6;
      this.whineCd = 10;
      this.range = 1.6;
      this.iy = 0.5;
      this.y = 0;
      this.alpha = 1;
    }
    get saveReady() { return this.saveCd <= 0 && this.state !== 'gone' && !this.hidden; }
    get interactive() { return !this.hidden && this.state !== 'gone' && this.state !== 'script'; }
    get prompt() { return 'Pet Biscuit'; }
    use() {
      this.anim.happy = 1.5;
      this.anim.lookUp = 0.4;
      this.idle = 0;
      this.petT = 1.5;
      MH.Audio.pant([this.x, 0.5, this.z]);
      this.G.story.petDog(this.G);
    }
    bark(n) {
      MH.Audio.bark([this.x, 0.6, this.z], n || 2);
      this.anim.bark = 1;
    }
    teleportNear(px, pz, behindYaw) {
      const L = this.G.level;
      for (let k = 0; k < 20; k++) {
        const a = behindYaw + Math.PI + (Math.random() - 0.5) * 2.2;
        const d = 2 + Math.random() * 3;
        const x = px - Math.sin(a) * d, z = pz - Math.cos(a) * d;
        if (L.walkableAt(x, z) && L.los(px, pz, x, z)) {
          this.x = x; this.z = z; this.path = null;
          return true;
        }
      }
      return false;
    }
    startGuide(target) {
      this.guideTarget = target;
      this.state = 'guide';
      this.path = null;
      this.guideT = 0;
    }
    update(dt) {
      const G = this.G, P = G.player, L = G.level, A = this.anim;
      if (this.hidden) return;
      A.t += dt;
      this.barkCd -= dt; this.growlCd -= dt; this.pantCd -= dt; this.whineCd -= dt;
      if (this.saveCd > 0) this.saveCd -= dt;
      if (this.hurt > 0) this.hurt -= dt;
      if (A.bark > 0) A.bark = Math.max(0, A.bark - dt * 4);
      if (this.petT > 0) this.petT -= dt;
      A.happy = MH.lerp(A.happy, 1, dt);
      A.lookUp = MH.lerp(A.lookUp, 0, dt * 2);
      const dP = dist(this.x, this.z, P.x, P.z);
      const lod = G.lodger && G.lodger.active ? G.lodger : null;
      const dL = lod ? dist(this.x, this.z, lod.x, lod.z) : 99;
      const lodSeen = lod && dL < 13 && L.los(this.x, this.z, lod.x, lod.z);
      let speed = 0, target = null, mode = 'stand';
      const hurtMul = this.hurt > 0 ? 0.6 : 1;

      if (this.state === 'follow') {
        if (dP > 28 || (dP > 14 && !L.los(this.x, this.z, P.x, P.z) && !inView(G, this.x, 0.5, this.z, 0.3))) {
          this.teleportNear(P.x, P.z, P.yaw);
        }
        const stopD = lodSeen ? 1.6 : 2.4;
        if (dP > stopD) {
          target = [P.x, P.z];
          speed = (dP > 6 ? 5.2 : dP > 3.5 ? 3.4 : 2.4) * hurtMul;
          this.idle = 0;
        } else {
          this.idle += dt;
        }
      } else if (this.state === 'guide') {
        this.guideT += dt;
        const [gx, gz] = this.guideTarget;
        if (dist(this.x, this.z, gx, gz) < 1.3 || this.guideT > 30) {
          this.state = 'waitAt';
          this.waitT = 0;
        } else {
          target = [gx, gz];
          // don't run too far ahead of the player
          speed = (dP > 9 ? 1.2 : 3.6) * hurtMul;
          if (dP > 12) { speed = 0; this.idle += dt; }
        }
      } else if (this.state === 'waitAt') {
        this.waitT += dt;
        const [gx, gz] = this.guideTarget;
        if (this.barkCd <= 0 && dP > 3) { this.bark(2); this.barkCd = 3.2; }
        if (dist(P.x, P.z, gx, gz) < 2.6 || this.waitT > 35) { this.state = 'follow'; this.idle = 0; }
        this.idle = 5;
      } else if (this.state === 'stay') {
        this.idle += dt;
      } else if (this.state === 'goto') {
        target = this.gotoTarget;
        speed = this.gotoSpeed || 2.5;
        if (dist(this.x, this.z, target[0], target[1]) < 0.4) { speed = 0; target = null; if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); } }
      } else if (this.state === 'script') {
        // animation controlled externally
        mode = this.scriptMode || 'stand';
      }

      if (target && speed > 0) {
        const res = steer(this, target[0], target[1], speed, dt, { opensDoors: true, doorDelay: 0.3, repath: 0.5 });
        if (res === 'nopath' && this.state === 'guide') this.state = 'waitAt';
        mode = this.curSpeed > 3.2 ? 'run' : this.curSpeed > 0.3 ? 'walk' : 'stand';
      } else if (this.state !== 'script') {
        // idle behaviour: face something interesting
        let faceYaw = MH.yawTo(this.x, this.z, P.x, P.z);
        if (lodSeen) faceYaw = MH.yawTo(this.x, this.z, lod.x, lod.z);
        else if (this.state === 'waitAt') faceYaw = MH.yawTo(this.x, this.z, P.x, P.z);
        this.yaw = MH.turnTowards(this.yaw, faceYaw, dt * 3);
        mode = this.idle > 4 && !lodSeen ? 'sit' : 'stand';
        if (this.pantCd <= 0 && dP < 6) { MH.Audio.pant([this.x, 0.5, this.z]); this.pantCd = 8 + Math.random() * 10; }
      }
      // alert behaviour
      if (lodSeen && this.state !== 'script') {
        A.happy = 0;
        if (mode === 'stand' || mode === 'sit') mode = 'growl';
        if (this.growlCd <= 0) {
          if (dL < 5 && this.barkCd <= 0) { this.bark(3); this.barkCd = 2.5; }
          else MH.Audio.growl([this.x, 0.5, this.z], 1.4);
          this.growlCd = 2.2 + Math.random();
        }
      }
      if (this.hurt > 0 && this.whineCd <= 0) { MH.Audio.whine([this.x, 0.5, this.z]); this.whineCd = 6 + Math.random() * 5; }
      // head look relative to body
      const lookAt = lodSeen ? [lod.x, lod.z] : [P.x, P.z];
      const rel = MH.wrapAngle(MH.yawTo(this.x, this.z, lookAt[0], lookAt[1]) - this.yaw);
      A.look = MH.lerp(A.look, MH.clamp(rel, -1, 1), dt * 5);
      A.tilt = this.state === 'waitAt' || this.petT > 0 ? Math.sin(A.t * 1.3) * 0.3 : MH.lerp(A.tilt, 0, dt * 2);
      A.mode = this.scriptMode && this.state === 'script' ? this.scriptMode : mode;
      A.phase += (this.curSpeed || 0) * dt * 5.5;
      if (mode !== 'walk' && mode !== 'run') this.curSpeed = 0;
    }
    draw(R) {
      if (this.hidden || this.alpha <= 0) return;
      const G = this.G;
      MH.Models.animateDog(this.rig, this.anim);
      this.rig.compute(M4.chain(M4.trans(this.x, this.y, this.z), M4.rotY(this.yaw)));
      this.rig.draw(R, G.items.cube, G.atlas.tiles, [1, 1, 1, 0.07]);
    }
  }

  // =====================================================================
  // THE LODGER
  // =====================================================================
  class Lodger extends Ent {
    constructor(G, o) {
      super(G, o);
      this.kind = 'lodger';
      this.rig = MH.Models.lodgerRig();
      this.r = 0.3;
      this.state = this.state || 'wander';
      this.anim = { t: 0, phase: 0, mode: 'idle', twitch: [0, 0, 0], jaw: 0, crouch: 0 };
      this.twT = 0; this.twTarget = [0, 0, 0];
      this.seeT = 0; this.lost = 0;
      this.pause = 0;
      this.voiceCd = 25 + Math.random() * 20;
      this.clickCd = 4 + Math.random() * 5;
      this.breathCd = 3;
      this.shriekCd = 0;
      this.stepAcc = 0;
      this.farT = 0;
      this.active = true;
      this.hidden = false;
      this.respawnT = 0;
      this.canSee = false;
      this.stunT = 0;
      this.heardAt = 0;
    }
    hide(seconds) {
      this.hidden = true;
      this.active = false;
      this.respawnT = seconds;
      this.path = null;
    }
    respawn() {
      const G = this.G, P = G.player, L = G.level;
      const spot = L.randomWalkable((x, z) => {
        const d = dist(x, z, P.x, P.z);
        return d > 11 && d < 22 && !L.los(x, z, P.x, P.z);
      }) || L.randomWalkable((x, z) => dist(x, z, P.x, P.z) > 9 && !L.los(x, z, P.x, P.z));
      if (!spot) { this.respawnT = 3; return; }
      this.x = spot[0]; this.z = spot[1];
      this.hidden = false; this.active = true;
      this.state = this.afterRespawn || 'wander';
      this.path = null; this.seeT = 0; this.pause = 1;
    }
    perceive(dt) {
      const G = this.G, P = G.player, L = G.level;
      const dx = P.x - this.x, dz = P.z - this.z;
      const d = Math.hypot(dx, dz);
      this.dP = d;
      let range = P.flashOn && P.battery > 0.01 ? 14 : 5;
      if (P.lamp) range = Math.max(range, 12);
      if (P.crouch > 0.5) range *= 0.7;
      if (P.flashOn && P.battery > 0.01) {
        const f = MH.forward(G.cam.yaw, G.cam.pitch);
        const toL = [-dx / d, -dz / d];
        if (f[0] * toL[0] + f[2] * toL[1] > 0.9) range = 20;
      }
      if (P.still > 1.5 && !P.flashOn && !P.lamp) range = Math.min(range, 2.2);
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const cosA = (dx * fx + dz * fz) / Math.max(d, 0.001);
      const fov = d < 2.2 || cosA > 0.25 || this.state === 'chase';
      this.canSee = G.canBeSeen() && d < range && fov && L.los(this.x, this.z, P.x, P.z);
      if (this.canSee) this.seeT += dt * (d < 4 ? 4 : 1);
      else this.seeT = Math.max(0, this.seeT - dt * 0.5);
      // hearing
      for (const n of G.noises) {
        if (n.t <= this.heardAt) continue;
        if (dist(n.x, n.z, this.x, this.z) < n.r && this.state !== 'chase' && this.state !== 'return' && this.state !== 'stunned') {
          this.state = 'investigate';
          this.invTarget = [n.x, n.z];
          this.path = null;
          this.pause = 0.4;
        }
      }
      if (G.noises.length) this.heardAt = G.noises[G.noises.length - 1].t;
    }
    startChase() {
      const G = this.G;
      if (this.state !== 'chase') {
        this.chaseT = 0;
        if (this.shriekCd <= 0) {
          MH.Audio.shriek([this.x, 2.0, this.z]);
          this.shriekCd = 14;
          this.anim.jaw = 1;
          G.scare(0.35);
        }
      }
      this.state = 'chase';
      this.lost = 0;
      if (!this.lastSeen) this.lastSeen = [G.player.x, G.player.z];
    }
    pickWanderTarget() {
      const G = this.G, P = G.player, L = G.level;
      const nearPlayer = Math.random() < 0.65;
      const spot = L.randomWalkable((x, z) => {
        const d = dist(x, z, P.x, P.z);
        return nearPlayer ? d > 4 && d < 13 : d > 3;
      });
      this.wanderTarget = spot || [this.x, this.z];
      this.path = null;
    }
    update(dt) {
      const G = this.G, P = G.player, A = this.anim;
      if (this.hidden) {
        if (this.respawnT > 0) {
          this.respawnT -= dt;
          if (this.respawnT <= 0) this.respawn();
        }
        return;
      }
      A.t += dt;
      this.shriekCd -= dt; this.voiceCd -= dt; this.clickCd -= dt; this.breathCd -= dt;
      A.jaw = MH.lerp(A.jaw, 0, dt * 1.5);
      if (this.state !== 'script' && this.state !== 'sleep' && this.state !== 'stunned') this.perceive(dt);
      else this.dP = dist(this.x, this.z, P.x, P.z);
      const d = this.dP;
      let speed = 0, target = null, opensDoors = true, doorDelay = 0.9;

      if ((this.state === 'wander' || this.state === 'investigate' || this.state === 'search' || this.state === 'return') &&
          this.seeT > 0.45) {
        if (this.state === 'return') this.returnAfter = true;
        this.startChase();
      }

      switch (this.state) {
        case 'wander': {
          if (this.pause > 0) { this.pause -= dt; break; }
          if (!this.wanderTarget) this.pickWanderTarget();
          target = this.wanderTarget;
          speed = 1.35;
          if (dist(this.x, this.z, target[0], target[1]) < 0.5) {
            this.wanderTarget = null;
            this.pause = 1.5 + Math.random() * 3.5;
            target = null;
          }
          // relocate if the player has slipped far away
          if (d > 22) this.farT += dt; else this.farT = 0;
          if (this.farT > 18 && !this.G.level.los(this.x, this.z, P.x, P.z)) { this.farT = 0; this.hide(0.1); }
          break;
        }
        case 'investigate': {
          if (this.pause > 0) { this.pause -= dt; break; }
          target = this.invTarget;
          speed = 2.2;
          if (dist(this.x, this.z, target[0], target[1]) < 0.6) {
            this.state = 'wander';
            this.wanderTarget = null;
            this.pause = 3 + Math.random() * 2;
            target = null;
          }
          break;
        }
        case 'chase': {
          this.chaseT = (this.chaseT || 0) + dt;
          if (this.canSee) { this.lastSeen = [P.x, P.z]; this.lost = 0; }
          else this.lost += dt;
          target = this.canSee ? [P.x, P.z] : this.lastSeen;
          speed = MH.lerp(2.6, G.lodgerSpeed || 3.95, MH.clamp(this.chaseT / 1.2, 0, 1));
          doorDelay = 0.25;
          if (this.lost > 3.5) {
            this.state = this.returnAfter ? 'return' : 'search';
            this.searchT = 0;
            this.path = null;
          }
          if (d < 0.95 && this.canSee) G.caught(this);
          break;
        }
        case 'search': {
          target = this.lastSeen;
          speed = 2.6;
          if (!target || dist(this.x, this.z, target[0], target[1]) < 0.6) {
            target = null;
            this.searchT = (this.searchT || 0) + dt;
            if (this.searchT > 4) { this.state = 'wander'; this.wanderTarget = null; }
          }
          break;
        }
        case 'return': {
          target = this.bedPos;
          speed = 1.8;
          if (dist(this.x, this.z, target[0], target[1]) < 0.7) {
            this.state = 'sleep';
            target = null;
            if (this.onBed) this.onBed();
          }
          break;
        }
        case 'stunned': {
          this.stunT -= dt;
          const back = this.stunDir || 0;
          const nx = this.x - Math.sin(back) * dt * 1.2, nz = this.z - Math.cos(back) * dt * 1.2;
          [this.x, this.z] = G.level.collide(nx, nz, this.r);
          if (this.stunT <= 0) {
            if (this.afterStun) { this.state = this.afterStun; this.afterStun = null; this.path = null; }
            else this.hide(22 + Math.random() * 15);
          }
          break;
        }
        case 'sleep':
        case 'script':
          break;
      }
      if (target && speed > 0) {
        const res = steer(this, target[0], target[1], speed, dt, { opensDoors, doorDelay, repath: this.state === 'chase' ? 0.3 : 0.8, turn: this.state === 'chase' ? 10 : 5 });
        if (res === 'nopath' || res === 'locked') {
          if (this.state === 'wander') this.wanderTarget = null;
          else if (this.state === 'investigate' || this.state === 'search') { this.state = 'wander'; this.wanderTarget = null; }
        }
      } else if (this.state !== 'stunned') {
        this.curSpeed = 0;
        if (this.state !== 'sleep' && this.state !== 'script') {
          // look around slowly while paused
          this.yaw += Math.sin(A.t * 0.6) * dt * 0.8;
        }
      }
      // facing the player during a chase
      if (this.state === 'chase' && this.canSee && d < 3) this.yaw = MH.turnTowards(this.yaw, MH.yawTo(this.x, this.z, P.x, P.z), dt * 10);

      // ---- sounds ----
      const pos = [this.x, 1.8, this.z];
      const sp = this.curSpeed || 0;
      this.stepAcc += sp * dt;
      if (this.stepAcc > (sp > 3 ? 1.3 : 0.85)) { this.stepAcc = 0; MH.Audio.cstep([this.x, 0.1, this.z]); }
      if (this.state !== 'sleep' && this.state !== 'script') {
        if (this.clickCd <= 0 && d < 20) { MH.Audio.clicks(pos); this.clickCd = 5 + Math.random() * 9; }
        if (this.breathCd <= 0 && d < 12) { MH.Audio.breath(pos); this.breathCd = 4 + Math.random() * 4; }
        if (this.voiceCd <= 0 && this.state === 'wander' && d > 5 && d < 24 && !this.canSee) {
          G.story.mimic(G, this);
          this.voiceCd = 38 + Math.random() * 40;
        }
      }
      // ---- animation ----
      this.twT -= dt;
      if (this.twT <= 0) {
        this.twTarget = [(Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8];
        this.twT = 0.3 + Math.random() * (this.state === 'chase' ? 0.6 : 2.2);
      }
      for (let k = 0; k < 3; k++) A.twitch[k] = MH.lerp(A.twitch[k], this.twTarget[k], Math.min(1, dt * 18));
      A.mode = this.forceMode || (this.state === 'stunned' ? 'stun' : this.state === 'sleep' ? 'idle' : sp > 3 ? 'run' : sp > 0.2 ? 'walk' : 'idle');
      A.crouch = this.state === 'sleep' ? 0.5 : 0;
      A.phase += sp * dt * (sp > 3 ? 2.3 : 2.6);
    }
    draw(R) {
      if (this.hidden) return;
      const G = this.G;
      MH.Models.animateLodger(this.rig, this.anim);
      this.rig.compute(this.rootMatrix());
      this.rig.draw(R, G.items.cube, G.atlas.tiles, [1, 1, 1, this.forceMode === 'reach' ? 0.45 : 0.045]);
    }
    rootMatrix() {
      if (this.state === 'sleep' && this.bedCenter) {
        const b = this.bedCenter;
        // lying on its back, head towards +x
        return M4.chain(M4.trans(b[0], b[1], b[2]), M4.rotX(Math.PI / 2), M4.rotZ(-Math.PI / 2), M4.trans(0, -1.15, 0));
      }
      return M4.chain(M4.trans(this.x, this.yOff || 0, this.z), M4.rotY(this.yaw));
    }
    headPos() {
      MH.Models.animateLodger(this.rig, this.anim);
      this.rig.compute(this.rootMatrix());
      const p = this.rig.pivotPos('head');
      return [p[0], p[1] + 0.12, p[2]];
    }
  }

  // =====================================================================
  // Dress forms that move when you are not looking
  // =====================================================================
  class Mannequin extends Ent {
    constructor(G, o) {
      super(G, o);
      this.rig = MH.Models.dressformRig(this.covered);
      this.cd = 2 + Math.random() * 3;
      this.r = 0.28;
      this.tilt = (Math.random() - 0.5) * 0.1;
    }
    update(dt) {
      const G = this.G, P = G.player, L = G.level;
      if (!G.flags.atticMove || this.frozen) return;
      const d = dist(this.x, this.z, P.x, P.z);
      const seen = inView(G, this.x, 1.2, this.z, 0.35) && L.los(P.x, P.z, this.x, this.z);
      if (seen) { this.cd = Math.max(this.cd, 0.6); return; }
      if (d < 1.4) return;
      this.cd -= dt;
      if (this.cd > 0) return;
      if (G.time - (G.lastMannequinMove || 0) < 0.8) return;
      const step = Math.min(0.8, d - 1.2);
      const nx = this.x + ((P.x - this.x) / d) * step, nz = this.z + ((P.z - this.z) / d) * step;
      if (!L.walkableAt(nx, nz, { ignoreBlock: true })) { this.cd = 1; return; }
      const [cx, cz] = L.collide(nx, nz, this.r);
      this.x = cx; this.z = cz;
      this.yaw = MH.yawTo(this.x, this.z, P.x, P.z);
      G.lastMannequinMove = G.time;
      this.cd = 1.2 + Math.random() * 2.5;
      if (Math.random() < 0.5) MH.Audio.creak([this.x, 0.5, this.z], 0.05);
    }
    draw(R) {
      const G = this.G;
      this.rig.set('pole', this.tilt, 0, 0);
      this.rig.compute(M4.chain(M4.trans(this.x, 0, this.z), M4.rotY(this.yaw)));
      this.rig.draw(R, G.items.cube, G.atlas.tiles, [1, 1, 1, 0.02]);
    }
  }

  // =====================================================================
  // A glimpse of the Lodger that isn't really there (yet)
  // =====================================================================
  class Apparition extends Ent {
    constructor(G, o) {
      super(G, o);
      this.rig = MH.Models.lodgerRig();
      this.anim = { t: 0, phase: 0, mode: 'idle', twitch: [0, 0, 0], jaw: 0.2, crouch: 0, lean: 0.15 };
      this.stare = 0;
      this.life = this.life || 12;
    }
    update(dt) {
      const G = this.G, P = G.player;
      this.anim.t += dt;
      this.life -= dt;
      const d = dist(this.x, this.z, P.x, P.z);
      this.yaw = MH.turnTowards(this.yaw, MH.yawTo(this.x, this.z, P.x, P.z), dt * 0.8);
      const seen = inView(G, this.x, 1.8, this.z, 0.8) && G.level.los(P.x, P.z, this.x, this.z);
      if (seen) {
        this.stare += dt;
        if (!this.noticed) { this.noticed = true; if (this.onSeen) this.onSeen(G, this); }
      }
      if (this.stare > (this.stareMax || 1.4) || d < (this.vanishDist || 7) || this.life <= 0) {
        this.alive = false;
        G.flickerFlash(0.5);
        MH.Audio.noise({ type: 'bandpass', f: 800, q: 2, dur: 0.6, a: 0.2, gain: 0.08, pos: [this.x, 1.7, this.z] });
        if (this.onGone) this.onGone(G, this);
      }
    }
    draw(R) {
      const G = this.G;
      MH.Models.animateLodger(this.rig, this.anim);
      this.rig.compute(M4.chain(M4.trans(this.x, 0, this.z), M4.rotY(this.yaw)));
      this.rig.draw(R, G.items.cube, G.atlas.tiles, [1, 1, 1, 0.2]);
    }
  }

  // Rectangular trigger zone in world space
  class Trigger extends Ent {
    update() {
      const P = this.G.player;
      const inside = P.x >= this.x0 && P.x <= this.x1 && P.z >= this.z0 && P.z <= this.z1;
      if (inside && (!this.cond || this.cond(this.G))) {
        if (this.once) this.alive = false;
        this.fn(this.G, this);
      }
    }
  }

  MH.Ent = { Ent, Thing, DoorEnt, Dog, Lodger, Mannequin, Apparition, Trigger, steer, inView };
})(window.MH);
