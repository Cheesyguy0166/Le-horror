'use strict';
// Marrow House - main loop, player, camera, transitions, menus.
(function (MH) {
  const M4 = MH.M4, UI = MH.UI, A = MH.Audio, tw = MH.tw;
  const SAVE_KEY = 'marrowhouse.save.v1';
  const SET_KEY = 'marrowhouse.settings.v1';

  const INTRO = `November 14th, 1999.

Grandma Ruth died three weeks ago. Nobody could tell me how.

The lawyer says the farmhouse has to be emptied before the county auction on Monday.

It's Sunday night. The snow started an hour ago.

I haven't been back to Marrow House since I was nine years old.`;

  const G = (MH.G = {
    state: 'boot', time: 0, realT: 0, flags: {}, inv: new Set(), notesRead: [],
    entities: [], noises: [], dynLights: [], timers: [], footprints: [],
    keys: {}, mouse: { dx: 0, dy: 0, down: false },
    sens: 1, invertY: false, scanlines: true, volume: 0.85,
    cam: { x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, roll: 0 },
    fx: { shake: 0, flash: 0, flashCol: [1, 1, 1], fade: 0, fadeCol: [0, 0, 0], flicker: 0, noise: 0, fadeDur: 0 },
    locked: false, talking: false, fear: 0,
  });
  G.story = MH.Story;

  const newPlayer = () => ({
    x: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, crouch: 0, stamina: 1, exhausted: false,
    battery: 1, flashOn: true, lamp: false, stepPhase: 0, stepAcc: 0, bobAmt: 0, still: 0,
    invuln: 0, eyeBoost: 0, moving: false, running: false, leftFoot: false,
  });
  const realWait = (ms) => new Promise((r) => setTimeout(r, ms));

  // =====================================================================
  // boot
  // =====================================================================
  G.init = function () {
    UI.init(G);
    const canvas = document.getElementById('gl');
    try {
      G.R = new MH.Renderer(canvas);
    } catch (e) {
      console.error(e);
      UI.error('Marrow House needs WebGL, and this browser could not start it. Try a recent Chrome, Firefox, Edge or Safari with hardware acceleration enabled.');
      return;
    }
    G.atlas = MH.buildAtlas();
    G.R.setAtlas(G.atlas.canvas);
    G.items = MH.Models.buildItems(G.R, G.atlas.tiles);
    G.dynMesh = G.R.createMesh(new Float32Array(16 * 6), true);
    G.player = newPlayer();
    G.flashDir = [0, 0, -1];
    loadSettings();
    bindInput();
    window.addEventListener('resize', () => G.R.resize());
    G.toTitle();
    G.last = performance.now();
    requestAnimationFrame(G.loop);
  };

  // =====================================================================
  // helpers used by the story
  // =====================================================================
  G.add = (e) => { G.entities.push(e); return e; };
  G.wait = (s) => new Promise((res) => G.timers.push({ t: G.time + s, res }));
  G.say = (text, dur, cls) => G.wait(UI.say(text, dur, cls) + 0.15);
  G.hint = (t, d) => UI.hint(t, d);
  G.setObjective = (text, quiet) => UI.objective(text || MH.Story.objective(G), quiet);
  G.lock = (b) => { G.locked = b; };
  G.shake = (a) => { G.fx.shake = Math.max(G.fx.shake, a); };
  G.flickerFlash = (d) => { G.fx.flicker = Math.max(G.fx.flicker, d); };
  G.noise = (x, z, r) => { if (r > 0) G.noises.push({ x, z, r, t: G.time }); };
  G.scare = (lv) => {
    A.stinger(lv);
    G.fx.flash = Math.max(G.fx.flash, 0.22 * lv);
    G.fx.flashCol = [1, 0.95, 0.9];
    G.fx.shake = Math.max(G.fx.shake, 0.35 * lv);
    G.fx.noise = Math.max(G.fx.noise, 0.7 * lv);
  };
  G.lights = (group, on) => { for (const L of G.level.lights) if (L.group === group) L.on = on; };
  G.canBeSeen = () => G.state === 'play' && G.player.invuln <= 0 && !G.transitioning;
  G.fade = (to, dur, col) => {
    const f = G.fx;
    if (col) f.fadeCol = col;
    f.fadeFrom = f.fade; f.fadeTo = to; f.fadeDur = Math.max(0.01, dur); f.fadeT = 0;
    return G.wait(dur);
  };
  G.lookAt = (x, y, z, speed) => new Promise((res) => { G.lookTarget = { x, y, z, speed: speed || 3, res, t: 0 }; });

  G.spawnDog = (x, z, state) => {
    const d = new MH.Ent.Dog(G, { x, z, state: state || 'follow' });
    G.dog = d;
    return G.add(d);
  };
  G.spawnDogNearPlayer = () => {
    const P = G.player, L = G.level;
    for (let k = 0; k < 16; k++) {
      const a = P.yaw + Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35;
      const x = P.x - Math.sin(a) * 1.3, z = P.z - Math.cos(a) * 1.3;
      if (L.walkableAt(x, z) && L.clearLine(P.x, P.z, x, z, 0.2)) {
        const d = G.spawnDog(x, z, 'follow');
        d.yaw = MH.yawTo(x, z, P.x, P.z);
        return d;
      }
    }
    return G.spawnDog(P.x, P.z, 'follow');
  };
  G.spawnLodger = (x, z, o) => {
    o = o || {};
    const l = new MH.Ent.Lodger(G, { x, z, state: o.state || 'wander', yaw: Math.random() * 6 });
    if (o.respawnIn) l.hide(o.respawnIn);
    G.lodger = l;
    return G.add(l);
  };
  G.useDoor = (door, fx, fz, who) => {
    const res = G.level.useDoor(door, fx, fz);
    const pos = [door.x, 1.1, door.z];
    if (res === 'locked') A.locked(pos);
    else if (res === 'opened') A.doorOpen(pos);
    else A.doorClose(pos, who === 'lodger');
    if (who === 'player') G.noise(door.x, door.z, 6);
    return res;
  };

  // =====================================================================
  // maps
  // =====================================================================
  G.loadMap = (id, spawn, opts) => {
    opts = opts || {};
    for (const e of G.entities) e.destroy();
    G.entities = [];
    G.noises = [];
    G.footprints = [];
    G.snow = null;
    G.lookTarget = null;
    if (G.level) G.R.deleteMesh(G.level.mesh);
    const def = MH.Maps[id];
    G.mapId = id;
    G.level = new MH.Level(def, G.R, G.atlas);
    G.dog = null;
    G.lodger = null;
    for (const d of G.level.doors) G.add(new MH.Ent.DoorEnt(G, d));
    const sp = typeof spawn === 'string' ? def.spawns[spawn] : spawn;
    const P = G.player;
    P.x = sp.x; P.z = sp.z; P.yaw = sp.yaw || 0; P.pitch = 0; P.vx = 0; P.vz = 0;
    P.lamp = G.inv.has('lamp');
    G.flashDir = MH.forward(P.yaw, 0);
    MH.Story.applyLights(G);
    G.setEnv(MH.Story.envKey(G, id));
    if (opts.title) populateTitle();
    else MH.Story.populate(G, id);
    if (id !== 'house') A.stopHum();
  };
  G.setEnv = (key) => {
    G.envKey = key;
    G.env = MH.Maps[G.mapId].env[key];
    A.setAmbience(G.state === 'title' ? 'title' : G.env.ambience);
  };

  G.goto = async (id, spawn, o) => {
    o = o || {};
    if (G.transitioning) return;
    G.transitioning = true;
    G.lock(true);
    G.player.invuln = 2;
    await G.fade(1, o.fadeOut || 0.45, o.color || [0, 0, 0]);
    G.loadMap(id, spawn);
    G.state = 'play';
    G.player.invuln = 1.5;
    G.transitioning = false;
    G.lock(false);
    G.checkpoint();
    G.fade(0, o.fadeIn || 0.7, o.color || [0, 0, 0]);
    MH.Story.onEnter(G, id);
  };

  function populateTitle() {
    const dog = G.spawnDog(tw(15) + 0.3, tw(11) + 0.5, 'script');
    dog.scriptMode = 'sit';
    dog.yaw = Math.PI - 0.2;
    const l = G.spawnLodger(tw(23) - 0.3, tw(13) + 0.5, { state: 'script' });
    l.yaw = Math.PI - 0.5;
  }

  // =====================================================================
  // checkpoints / saving
  // =====================================================================
  G.checkpoint = () => {
    const P = G.player;
    const flags = JSON.parse(JSON.stringify(G.flags));
    delete flags.ringing; delete flags.escaping;
    G.cp = {
      map: G.mapId, pos: { x: P.x, z: P.z, yaw: P.yaw }, flags,
      inv: [...G.inv], notes: [...G.notesRead], battery: P.battery,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.cp)); } catch (e) { /* storage unavailable */ }
  };
  const loadSave = () => {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  };
  G.clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ok */ } };

  G.restore = (cp) => {
    cp = cp || G.cp;
    if (!cp) { G.toTitle(); return; }
    G.timers = [];
    G.talking = false;
    G.talkChain = null;
    G.talkGen = (G.talkGen || 0) + 1;
    G.transitioning = false;
    G.deathReady = false;
    G.flags = JSON.parse(JSON.stringify(cp.flags));
    G.inv = new Set(cp.inv);
    G.notesRead = [...cp.notes];
    G.player = newPlayer();
    G.player.battery = Math.max(cp.battery, 0.35);
    G.player.invuln = 3;
    G.lock(false);
    UI.hideScreens();
    UI.clearSubs();
    UI.show('hud');
    UI.el.cross.classList.add('on');
    G.state = 'play';
    G.loadMap(cp.map, cp.pos);
    G.cp = cp;
    G.fx.fade = 1; G.fx.fadeCol = [0, 0, 0];
    G.fade(0, 1.5);
    G.fx.flash = 0; G.fx.shake = 0;
    G.setObjective();
    A.setChase(0);
    requestLock();
  };

  // =====================================================================
  // scares, rescue, death
  // =====================================================================
  G.caught = (lod) => {
    if (G.state !== 'play' || G.player.invuln > 0 || G.transitioning || G.locked) return;
    const dog = G.dog;
    if (dog && dog.saveReady && !G.flags.noSave) dogSave(lod, dog);
    else death(lod);
  };

  async function dogSave(lod, dog) {
    const P = G.player, finale = G.mapId === 'cellar';
    P.invuln = 4.5;
    G.lock(true);
    const dd = MH.dist(dog.x, dog.z, P.x, P.z);
    if (dd > 3.5 || !G.level.los(dog.x, dog.z, P.x, P.z)) {
      dog.x = MH.lerp(P.x, lod.x, 0.45);
      dog.z = MH.lerp(P.z, lod.z, 0.45);
      dog.path = null;
    }
    dog.yaw = MH.yawTo(dog.x, dog.z, lod.x, lod.z);
    dog.bark(4);
    A.growl([dog.x, 0.5, dog.z], 1.6);
    lod.state = 'stunned';
    lod.stunT = 1.7;
    lod.stunDir = MH.yawTo(P.x, P.z, lod.x, lod.z);
    lod.afterStun = finale ? 'return' : null;
    lod.anim.jaw = 1.2;
    A.shriek([lod.x, 2, lod.z]);
    G.scare(0.9);
    G.say('BISCUIT!', 1.6);
    await G.wait(1.0);
    G.lock(false);
    dog.saveCd = finale ? 12 : 60;
    dog.hurt = finale ? 6 : 40;
    if (!G.flags.savedOnce) {
      G.flags.savedOnce = true;
      await G.wait(1.8);
      G.hint("Biscuit drove it off. He'll need time before he can do that again.", 7);
    }
  }

  async function death(lod) {
    G.state = 'dead';
    G.lock(true);
    UI.prompt(null);
    const P = G.player;
    lod.state = 'script';
    lod.hidden = false;
    // bend it down so its face ends up right in front of the lens
    const yaw = P.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    lod.x = P.x + fx * 1.2;
    lod.z = P.z + fz * 1.2;
    lod.yaw = yaw + Math.PI;
    lod.yOff = 0;
    lod.forceMode = 'reach';
    lod.anim.mode = 'reach';
    lod.anim.jaw = 1.4;
    lod.anim.lean = 0.95;
    lod.anim.twitch = [0, 0, 0];
    lod.twT = 99;
    const eye = 1.62 - P.crouch * 0.62;
    const h = lod.headPos();
    lod.x += P.x + fx * 0.42 - h[0];
    lod.z += P.z + fz * 0.42 - h[2];
    lod.yOff = eye - 0.05 - h[1];
    P.pitch = 0;
    A.jumpscare();
    G.fx.flash = 0.7;
    G.fx.flashCol = [0.55, 0.02, 0.02];
    G.fx.shake = 1.4;
    G.fx.noise = 1;
    await G.wait(1.15);
    G.fx.fade = 1;
    G.fx.fadeCol = [0, 0, 0];
    A.setChase(0);
    A.setFear(0);
    await G.wait(0.9);
    UI.death(MH.Story.deathText());
    G.deathReady = true;
    if (document.pointerLockElement) { G.wantUnlock = true; document.exitPointerLock(); }
  }

  // =====================================================================
  // title / intro / ending
  // =====================================================================
  G.toTitle = () => {
    G.state = 'title';
    G.flags = {};
    G.inv = new Set();
    G.notesRead = [];
    G.timers = [];
    G.talking = false;
    G.talkChain = null;
    G.talkGen = (G.talkGen || 0) + 1;
    G.player = newPlayer();
    G.player.flashOn = false;
    G.lock(false);
    G.loadMap('yard', { x: tw(14) + 1.6, z: tw(29), yaw: 0 }, { title: true });
    UI.hideScreens();
    UI.clearSubs();
    UI.show('hud', false);
    UI.el.cross.classList.remove('on');
    UI.show('title');
    document.getElementById('btn-continue').hidden = !loadSave();
    G.titleT = 0;
    G.fx.fade = 0;
    A.setChase(0); A.setFear(0);
    if (document.pointerLockElement) { G.wantUnlock = true; document.exitPointerLock(); }
  };

  async function newGame() {
    A.init();
    A.setVolume(G.volume);
    G.clearSave();
    G.flags = {}; G.inv = new Set(); G.notesRead = []; G.timers = [];
    G.player = newPlayer();
    UI.hideScreens();
    UI.show('intro');
    G.state = 'intro';
    A.setAmbience('wind');
    await UI.typewriter(UI.el.introText, INTRO, 34);
    await new Promise((res) => { G.introNext = res; });
    G.introNext = null;
    UI.show('intro', false);
    G.loadMap('yard', 'start');
    G.state = 'play';
    UI.show('hud');
    UI.el.cross.classList.add('on');
    G.fx.fade = 1; G.fx.fadeCol = [0, 0, 0];
    G.fade(0, 3);
    G.checkpoint();
    requestLock();
    MH.Story.onEnter(G, 'yard');
  }

  function continueGame() {
    const cp = loadSave();
    if (!cp) return;
    A.init();
    A.setVolume(G.volume);
    G.restore(cp);
  }

  G.showEnding = async () => {
    G.state = 'ending';
    G.endingReady = false;
    UI.hideScreens();
    UI.show('hud', false);
    UI.show('ending');
    A.setChase(0); A.setFear(0);
    A.setAmbience('morning');
    if (document.pointerLockElement) { G.wantUnlock = true; document.exitPointerLock(); }
    const el = UI.el.endingText;
    el.innerHTML = '';
    for (const line of MH.Story.ENDING) {
      const p = document.createElement('p');
      p.textContent = line;
      p.style.opacity = 0;
      p.style.transition = 'opacity 2.2s';
      el.appendChild(p);
      await realWait(60);
      p.style.opacity = 1;
      await realWait(3600);
    }
    await realWait(1200);
    const gb = document.createElement('p');
    gb.textContent = 'Good boy.';
    gb.style.opacity = 0; gb.style.transition = 'opacity 3s';
    el.appendChild(gb);
    await realWait(60);
    gb.style.opacity = 1;
    MH.Audio.bark([0, 1, -30], 1);
    await realWait(5000);
    el.style.transition = 'opacity 2s';
    el.style.opacity = 0;
    await realWait(2200);
    el.innerHTML = '<span class="big">MARROW HOUSE</span>THE END<span class="small">thank you for playing &nbsp;·&nbsp; click to return</span>';
    el.style.opacity = 1;
    G.endingReady = true;
  };

  // =====================================================================
  // menus / input
  // =====================================================================
  function requestLock() {
    const c = G.R.canvas;
    if (document.pointerLockElement === c) return;
    try {
      const p = c.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* pointer lock unavailable: drag to look */ }
  }
  G.pause = () => {
    if (G.state !== 'play') return;
    G.state = 'pause';
    UI.show('pause');
    if (A.ctx) A.ctx.suspend();
    if (document.pointerLockElement) { G.wantUnlock = true; document.exitPointerLock(); }
  };
  G.resume = () => {
    if (G.state !== 'pause') return;
    UI.show('pause', false);
    G.state = 'play';
    if (A.ctx) A.ctx.resume();
    requestLock();
  };
  function openJournal() {
    G.state = 'journal';
    if (document.pointerLockElement) { G.wantUnlock = true; document.exitPointerLock(); }
    UI.showJournal(G, (id) => {
      UI.show('journal', false);
      G.state = 'play';
      G.readNote(id);
      requestLock();
    });
  }
  function closeJournal() {
    UI.show('journal', false);
    G.state = 'play';
    requestLock();
  }
  G.readNote = (id) => new Promise((resolve) => {
    const n = MH.Story.NOTES[id];
    if (!n) { resolve(); return; }
    if (!G.notesRead.includes(id)) G.notesRead.push(id);
    A.paper();
    UI.showNote(n);
    G.state = 'note';
    G.noteClose = () => {
      G.noteClose = null;
      UI.hideNote();
      G.state = 'play';
      A.paper();
      resolve();
      MH.Story.onRead(G, id);
    };
  });

  function interact() {
    if (G.locked || !G.focus) return;
    G.focus.use();
  }
  function toggleFlash() {
    const P = G.player;
    P.flashOn = !P.flashOn;
    A.flashClick();
    if (P.flashOn && P.battery <= 0) G.hint('The batteries are dead.', 3);
  }
  function whistle() {
    if (G.locked || G.time - (G.lastWhistle || -9) < 1.5) return;
    G.lastWhistle = G.time;
    A.whistle();
    G.noise(G.player.x, G.player.z, 9);
    MH.Story.whistle(G);
  }

  function onKey(code) {
    switch (G.state) {
      case 'play':
        if (code === 'KeyE' || code === 'Space') interact();
        else if (code === 'KeyF') toggleFlash();
        else if (code === 'KeyQ') whistle();
        else if (code === 'Tab' || code === 'KeyJ') openJournal();
        else if (code === 'Escape' || code === 'KeyP') G.pause();
        break;
      case 'note':
        if (['KeyE', 'Escape', 'Space', 'Enter', 'Tab'].includes(code) && G.noteClose) G.noteClose();
        break;
      case 'journal':
        if (['Tab', 'Escape', 'KeyJ'].includes(code)) closeJournal();
        break;
      case 'pause':
        if (code === 'Escape' || code === 'KeyP') G.resume();
        break;
      case 'intro':
        if (G.introNext) G.introNext(); else UI.skipType = true;
        break;
      case 'dead':
        if (G.deathReady) G.restore();
        break;
      case 'ending':
        if (G.endingReady) G.toTitle();
        break;
    }
  }

  function onClick(e) {
    const c = G.R.canvas;
    switch (G.state) {
      case 'play':
        if (document.pointerLockElement !== c) { requestLock(); G.mouse.down = true; }
        break;
      case 'note':
        if (G.noteClose) G.noteClose();
        break;
      case 'intro':
        if (G.introNext) G.introNext(); else UI.skipType = true;
        break;
      case 'dead':
        if (G.deathReady) G.restore();
        break;
      case 'ending':
        if (G.endingReady) G.toTitle();
        break;
    }
    void e;
  }

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      G.keys[e.code] = true;
      onKey(e.code);
    });
    window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      if (G.state !== 'play') return;
      if (document.pointerLockElement === G.R.canvas || G.mouse.down) {
        G.mouse.dx += e.movementX || 0;
        G.mouse.dy += e.movementY || 0;
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('button, input, label')) return;
      onClick(e);
    });
    document.addEventListener('mouseup', () => { G.mouse.down = false; });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== G.R.canvas && G.state === 'play' && !G.wantUnlock) G.pause();
      G.wantUnlock = false;
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) G.pause(); });
    const $ = (s) => document.querySelector(s);
    $('#btn-new').onclick = () => newGame();
    $('#btn-continue').onclick = () => continueGame();
    $('#btn-resume').onclick = () => G.resume();
    $('#btn-retry').onclick = () => { UI.show('pause', false); if (A.ctx) A.ctx.resume(); G.restore(); };
    $('#btn-quit').onclick = () => { if (A.ctx) A.ctx.resume(); G.toTitle(); };
    const sens = $('#opt-sens'), vol = $('#opt-vol'), scan = $('#opt-scan'), inv = $('#opt-invert');
    sens.value = G.sens; vol.value = G.volume; scan.checked = G.scanlines; inv.checked = G.invertY;
    sens.oninput = () => { G.sens = +sens.value; saveSettings(); };
    vol.oninput = () => { G.volume = +vol.value; A.setVolume(G.volume); saveSettings(); };
    scan.onchange = () => { G.scanlines = scan.checked; saveSettings(); };
    inv.onchange = () => { G.invertY = inv.checked; saveSettings(); };
  }
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}');
      if (s.sens) G.sens = s.sens;
      if (s.volume != null) G.volume = s.volume;
      if (s.scanlines != null) G.scanlines = s.scanlines;
      if (s.invertY != null) G.invertY = s.invertY;
    } catch (e) { /* defaults */ }
  }
  function saveSettings() {
    try {
      localStorage.setItem(SET_KEY, JSON.stringify({ sens: G.sens, volume: G.volume, scanlines: G.scanlines, invertY: G.invertY }));
    } catch (e) { /* ok */ }
  }

  // =====================================================================
  // simulation
  // =====================================================================
  function updatePlayer(dt) {
    const P = G.player, K = G.keys, L = G.level;
    const canMove = G.state === 'play' && !G.locked;
    if (canMove) {
      const s = 0.0023 * G.sens;
      P.yaw -= G.mouse.dx * s;
      P.pitch -= G.mouse.dy * s * (G.invertY ? -1 : 1);
      if (K.ArrowLeft) P.yaw += 2.2 * dt;
      if (K.ArrowRight) P.yaw -= 2.2 * dt;
      P.pitch = MH.clamp(P.pitch, -1.45, 1.45);
    }
    G.mouse.dx = 0; G.mouse.dy = 0;
    const lt = G.lookTarget;
    if (lt) {
      lt.t += dt;
      const ty = MH.yawTo(G.cam.x, G.cam.z, lt.x, lt.z);
      const tp = Math.atan2(lt.y - G.cam.y, Math.max(0.01, MH.dist(G.cam.x, G.cam.z, lt.x, lt.z)));
      P.yaw = MH.turnTowards(P.yaw, ty, dt * lt.speed);
      P.pitch = MH.turnTowards(P.pitch, tp, dt * lt.speed * 0.7);
      if ((Math.abs(MH.wrapAngle(ty - P.yaw)) < 0.02 && Math.abs(tp - P.pitch) < 0.02) || lt.t > 2.5) {
        G.lookTarget = null;
        lt.res();
      }
    }
    let mx = 0, mz = 0;
    if (canMove) {
      const f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
      const s = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      mx = fx * f + rx * s;
      mz = fz * f + rz * s;
      const l = Math.hypot(mx, mz);
      if (l > 1) { mx /= l; mz /= l; }
    }
    const wantCrouch = canMove && (K.KeyC || K.ControlLeft || K.ControlRight);
    P.crouch = MH.lerp(P.crouch, wantCrouch ? 1 : 0, 1 - Math.exp(-dt * 10));
    const moving = Math.hypot(mx, mz) > 0.1;
    let running = canMove && moving && (K.ShiftLeft || K.ShiftRight) && P.crouch < 0.5 && !P.exhausted;
    if (running) {
      P.stamina -= dt / 5;
      if (P.stamina <= 0) { P.stamina = 0; P.exhausted = true; running = false; }
    } else {
      P.stamina = Math.min(1, P.stamina + dt / (moving ? 7 : 4));
      if (P.exhausted && P.stamina > 0.35) P.exhausted = false;
    }
    const speed = P.crouch > 0.5 ? 1.2 : running ? 4.4 : 2.35;
    const k = 1 - Math.exp(-dt * 12);
    P.vx = MH.lerp(P.vx, mx * speed, k);
    P.vz = MH.lerp(P.vz, mz * speed, k);
    const ox = P.x, oz = P.z;
    [P.x, P.z] = L.collide(P.x + P.vx * dt, P.z + P.vz * dt, 0.3);
    const moved = Math.hypot(P.x - ox, P.z - oz);
    const spd = moved / Math.max(dt, 1e-4);
    P.moving = spd > 0.2;
    P.running = running;
    P.still = spd > 0.3 ? 0 : P.still + dt;
    P.stepAcc += moved;
    const stride = running ? 1.05 : P.crouch > 0.5 ? 0.6 : 0.8;
    if (P.stepAcc > stride) {
      P.stepAcc = 0;
      const c = L.cellAt(P.x, P.z);
      const surface = (c && c.d.step) || 'wood';
      A.step(surface, running ? 1.3 : P.crouch > 0.5 ? 0.35 : 0.8);
      G.noise(P.x, P.z, running ? 11 : P.crouch > 0.5 ? 1.2 : 4);
      P.leftFoot = !P.leftFoot;
      if (surface === 'snow' && G.env.snow != null) {
        const side = P.leftFoot ? 0.12 : -0.12;
        G.footprints.push({ x: P.x + Math.cos(P.yaw) * side, z: P.z - Math.sin(P.yaw) * side, yaw: P.yaw });
        if (G.footprints.length > 140) G.footprints.shift();
      }
    }
    P.stepPhase += spd * dt * (running ? 1.9 : 2.4);
    P.bobAmt = MH.lerp(P.bobAmt, Math.min(1, spd / 2.5), 1 - Math.exp(-dt * 8));
    if (P.flashOn && G.state === 'play') P.battery = Math.max(0, P.battery - dt / 560);
    if (P.invuln > 0) P.invuln -= dt;
    if (P.exhausted && Math.random() < dt * 1.2) A.breathPlayer(1);
  }

  function updateCamera() {
    const P = G.player, c = G.cam, sh = G.fx.shake;
    const eye = 1.62 - P.crouch * 0.62 + (P.eyeBoost || 0);
    const bob = Math.sin(P.stepPhase * 2) * 0.04 * P.bobAmt;
    const r = () => (Math.random() - 0.5) * sh;
    c.x = P.x + r() * 0.06;
    c.z = P.z + r() * 0.06;
    c.y = eye + bob + r() * 0.06;
    c.yaw = P.yaw + r() * 0.04;
    c.pitch = P.pitch + r() * 0.04;
    c.roll = Math.sin(P.stepPhase) * 0.008 * P.bobAmt + r() * 0.02;
  }

  function updateLights(dt) {
    const fearFlicker = G.fear > 0.5;
    for (const L of G.level.lights) {
      if (!L.on) { L.intensity = 0; continue; }
      let I = L.base;
      if (L.flicker > 0) {
        if (L.dip > 0) { L.dip -= dt; I *= 0.12; }
        else if (Math.random() < L.flicker * dt * 3) L.dip = 0.04 + Math.random() * 0.3;
      }
      if (fearFlicker && Math.random() < 0.08) I *= 0.25;
      L.intensity = I;
    }
  }

  function updateFear(dt) {
    let target = 0;
    const lod = G.lodger;
    const hunting = lod && lod.active && !lod.hidden && lod.state !== 'sleep' && lod.state !== 'script';
    if (hunting) {
      const d = lod.dP || 99;
      target = MH.clamp(1 - d / 16, 0, 1) * (lod.state === 'chase' ? 1 : 0.6);
      if (lod.state === 'chase') target = Math.max(target, 0.55);
    }
    if (G.state === 'dead') target = 0;
    G.fear = MH.lerp(G.fear, target, 1 - Math.exp(-dt * 2));
    A.setFear(G.fear);
    A.setChase(hunting && lod.state === 'chase' && G.state === 'play' ? 1 : 0);
  }

  function updateFx(dt) {
    const f = G.fx;
    f.shake = Math.max(0, f.shake - dt * 1.5);
    f.flash = Math.max(0, f.flash - dt * 1.6);
    f.noise = Math.max(0, f.noise - dt * 1.1);
    f.flicker = Math.max(0, f.flicker - dt);
    if (f.fadeDur) {
      f.fadeT += dt;
      f.fade = MH.lerp(f.fadeFrom, f.fadeTo, Math.min(1, f.fadeT / f.fadeDur));
      if (f.fadeT >= f.fadeDur) f.fadeDur = 0;
    }
  }

  function findInteract() {
    const c = G.cam, f = MH.forward(c.yaw, c.pitch);
    let best = null, bestScore = -1e9;
    for (const e of G.entities) {
      if (!e.alive || !e.interactive) continue;
      const iy = e.iy != null ? e.iy : e.y;
      const dx = e.x - c.x, dy = iy - c.y, dz = e.z - c.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > (e.range || 1.8)) continue;
      const cos = (dx * f[0] + dy * f[1] + dz * f[2]) / Math.max(d, 1e-3);
      if (cos < (d < 0.9 ? 0.5 : 0.82)) continue;
      if (d > 0.9 && !G.level.los(c.x, c.z, e.x, e.z)) continue;
      const score = cos * 2 - d * 0.3;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function update(dt) {
    G.time += dt;
    if (G.timers.length) {
      const due = G.timers.filter((t) => t.t <= G.time);
      if (due.length) {
        G.timers = G.timers.filter((t) => t.t > G.time);
        due.forEach((t) => t.res());
      }
    }
    G.dynLights = [];
    G.noises = G.noises.filter((n) => G.time - n.t < 1.0);
    updatePlayer(dt);
    G.level.update(dt);
    for (let i = 0; i < G.entities.length; i++) {
      const e = G.entities[i];
      if (e.alive) e.update(dt);
    }
    if (G.entities.some((e) => !e.alive)) {
      G.entities = G.entities.filter((e) => { if (!e.alive) { e.destroy(); return false; } return true; });
    }
    updateLights(dt);
    updateFear(dt);
    updateFx(dt);
    G.focus = G.state === 'play' && !G.locked ? findInteract() : null;
    UI.prompt(G.focus ? G.focus.prompt : null);
    A.update(dt, true);
    UI.update(dt, G);
  }

  function updateTitle(dt) {
    G.titleT += dt;
    G.time += dt;
    const t = G.titleT, P = G.player;
    const span = 34;
    const k = (t % span) / span;
    P.x = tw(14) + 2.0 + Math.sin(t * 0.13) * 0.6;
    P.z = MH.lerp(tw(29), tw(19), k);
    P.yaw = 0.12 + Math.sin(t * 0.09) * 0.12;
    P.pitch = 0.06 + Math.sin(t * 0.07) * 0.03;
    P.stepPhase = t * 1.2;
    P.bobAmt = 0.3;
    G.fx.fade = k < 0.06 ? 1 - k / 0.06 : k > 0.94 ? (k - 0.94) / 0.06 : 0;
    G.level.update(dt);
    for (const e of G.entities) e.update(dt);
    updateLights(dt);
    A.update(dt, false);
  }

  // =====================================================================
  // rendering
  // =====================================================================
  function pushQuad(a, p0, p1, p2, p3, tile, col) {
    const n = [0, 1, 0];
    const v = (p, u, w) => a.push(p[0], p[1], p[2], n[0], n[1], n[2], u, w, tile[0], tile[1], tile[2], tile[3], col[0], col[1], col[2], col[3]);
    v(p0, 0, 1); v(p1, 1, 1); v(p2, 1, 0);
    v(p0, 0, 1); v(p2, 1, 0); v(p3, 0, 0);
  }

  function drawDynamic(R, dt) {
    const a = [];
    const tiles = G.atlas.tiles, c = G.cam;
    if (G.env.snow) {
      if (!G.snow) {
        G.snow = [];
        for (let i = 0; i < 650; i++) {
          G.snow.push({ x: c.x + (Math.random() - 0.5) * 22, y: Math.random() * 9, z: c.z + (Math.random() - 0.5) * 22, s: 0.6 + Math.random() * 0.6, p: Math.random() * 6 });
        }
      }
      const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
      const t = G.realT;
      const tile = tiles.white, col = [0.85, 0.88, 0.95, 0.5];
      for (const f of G.snow) {
        f.y -= f.s * dt;
        f.x += (Math.sin(t * 0.7 + f.p) * 0.3 + 0.35) * dt;
        f.z += Math.cos(t * 0.5 + f.p) * 0.15 * dt;
        if (f.y < 0) { f.y += 9; f.x = c.x + (Math.random() - 0.5) * 22; f.z = c.z + (Math.random() - 0.5) * 22; }
        if (f.x - c.x > 11) f.x -= 22; else if (f.x - c.x < -11) f.x += 22;
        if (f.z - c.z > 11) f.z -= 22; else if (f.z - c.z < -11) f.z += 22;
        const cell = G.level.cellAt(f.x, f.z);
        if (cell && cell.d.ceil) continue;
        const s = 0.022;
        pushQuad(a, [f.x - rx * s, f.y - s, f.z - rz * s], [f.x + rx * s, f.y - s, f.z + rz * s],
          [f.x + rx * s, f.y + s, f.z + rz * s], [f.x - rx * s, f.y + s, f.z - rz * s], tile, col);
      }
    }
    if (G.footprints.length) {
      const tile = tiles.footprint, col = [1, 1, 1, 0];
      for (const p of G.footprints) {
        const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw);
        const P = (x, z) => [p.x + cs * x + sn * z, 0.012, p.z - sn * x + cs * z];
        pushQuad(a, P(-0.07, 0.15), P(0.07, 0.15), P(0.07, -0.15), P(-0.07, -0.15), tile, col);
      }
    }
    if (a.length) {
      R.updateMesh(G.dynMesh, new Float32Array(a));
      R.draw(G.dynMesh, null);
    }
  }

  function gatherLights() {
    const c = G.cam, P = G.player;
    const arr = [];
    for (const L of G.level.lights) if (L.on && L.intensity > 0.01) arr.push(L);
    for (const L of G.dynLights) arr.push(L);
    if (P.lamp && G.state !== 'title') {
      arr.push({
        x: P.x - Math.sin(P.yaw) * 0.3 + Math.cos(P.yaw) * 0.25, y: 1.1, z: P.z - Math.cos(P.yaw) * 0.3 - Math.sin(P.yaw) * 0.25,
        col: [1, 0.66, 0.35], radius: 6.5, intensity: 0.85 + Math.sin(G.realT * 13) * 0.04 + Math.random() * 0.05, bounds: null,
      });
    }
    const score = (L) => Math.hypot(L.x - c.x, L.z - c.z) - L.radius * 0.8;
    arr.sort((a, b) => score(a) - score(b));
    return arr.slice(0, 8);
  }

  function render(dt) {
    const R = G.R, P = G.player, c = G.cam;
    if (!G.level) return;
    updateCamera();
    const proj = M4.persp((68 * Math.PI) / 180, R.lowW / R.lowH, 0.05, 80);
    const view = MH.viewMatrix(c.x, c.y, c.z, c.yaw, c.pitch, c.roll);
    const fwd = MH.forward(c.yaw, c.pitch);
    const k = 1 - Math.exp(-dt * 13);
    const fd = G.flashDir;
    for (let i = 0; i < 3; i++) fd[i] = MH.lerp(fd[i], fwd[i], k);
    const l = Math.hypot(fd[0], fd[1], fd[2]) || 1;
    const d = [fd[0] / l, fd[1] / l, fd[2] / l];
    const dv = [view[0] * d[0] + view[4] * d[1] + view[8] * d[2], view[1] * d[0] + view[5] * d[1] + view[9] * d[2], view[2] * d[0] + view[6] * d[1] + view[10] * d[2]];
    let power = 0;
    if (G.state !== 'title' && P.flashOn && P.battery > 0) {
      power = 1.9;
      if (P.battery < 0.12) power *= 0.45 + 0.55 * (P.battery / 0.12);
      if (P.battery < 0.15 && Math.random() < 0.07) power *= 0.2;
      if (G.fx.flicker > 0 && Math.random() < 0.5) power *= 0.08;
      if (G.fear > 0.4 && Math.random() < G.fear * 0.1) power *= 0.15;
    }
    const env = G.env;
    R.begin({ view, proj }, { fog: env.fog, fogNear: env.fogNear, fogFar: env.fogFar, amb: env.amb, affine: 0.7 },
      { pos: [0.16, -0.22, 0.05], dir: dv, power, cosOuter: 0.82, cosInner: 0.945, col: [1, 0.93, 0.78] }, gatherLights());
    R.draw(G.level.mesh, null);
    for (const e of G.entities) if (e.alive) e.draw(R);
    drawDynamic(R, dt);
    const fx = R.fx;
    fx.time = G.realT;
    fx.fear = G.state === 'title' ? 0.05 : G.fear;
    fx.fade = G.fx.fade;
    fx.fadeCol = G.fx.fadeCol;
    fx.flash = G.fx.flash;
    fx.flashCol = G.fx.flashCol;
    fx.noise = Math.min(1, G.fx.noise + Math.max(0, G.fear - 0.6) * 0.6);
    fx.scan = G.scanlines ? 1 : 0;
    R.end();
    A.setListener(c.x, c.y, c.z, fwd[0], fwd[1], fwd[2]);
  }

  G.loop = (now) => {
    const dt = Math.min(0.05, Math.max(0.0005, (now - G.last) / 1000)) * (G.timeScale || 1);
    G.last = now;
    G.realT += dt;
    try {
      if (G.state === 'play' || G.state === 'cutscene' || G.state === 'dead') update(dt);
      else if (G.state === 'title') updateTitle(dt);
      else if (G.state === 'intro' || G.state === 'note' || G.state === 'journal') UI.update(0, G);
      if (G.state !== 'ending' && G.state !== 'intro') render(dt);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(G.loop);
  };

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => G.init());
  else G.init();
})(window.MH);
