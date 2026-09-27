'use strict';
// Marrow House - the story: notes, scripted events, objectives, and who goes where.
(function (MH) {
  const S = MH.TILE, tw = MH.tw;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // =====================================================================
  // PAGES
  // =====================================================================
  const NOTES = {
    letter: {
      title: 'Letter from Hollis & Grieve, Attorneys', style: 'type',
      text: `Dear Robin,

Please accept our sincere condolences on the passing of your grandmother, Ruth Marrow.

As her only surviving relative, the property at 14 Pale Creek Road passes to you. The county auction is set for Monday the 15th unless you choose to keep it. The house must be emptied either way.

Mrs. Marrow's will contains one unusual instruction, which we are obliged to pass on to you word for word:

      "Tell Robin to keep the Sunday supper.
       Before dark. Knock twice."

We assume this is a family tradition of some sort.

Sincerely,
D. Hollis`,
    },
    rules: {
      title: 'A note on the refrigerator', style: 'hand',
      text: `RULES OF THE HOUSE
(for whoever stays here after me)

1. Every Sunday before dark, leave a full plate at the cellar door. Knock twice. Walk away. Do not stay to hear it eat.

2. Never open the cellar door. Not for any reason. Not for any voice.

3. If you hear me calling from downstairs, it is not me.

4. It sees light. If it is close, put out your light and keep still.

5. It hears running. Walk.

6. Trust the dog. The dog always knows where it is.

7. If a Sunday is ever missed, God help you. Read my diary. It will tell you what to do.

      — R.`,
    },
    grocery: {
      title: 'A shopping list', style: 'hand',
      text: `- Roast for Sunday (a big one)
- Batteries for the flashlight
- Lamp oil
- Call Dr. Weir about my hands
- Write to Sweetpea
- Tell Sweetpea everything. Before it's too late.`,
    },
    diary: {
      title: "Ruth Marrow's diary", style: 'hand',
      text: `March 4th, 1962
I was too sick to carry the plate down on Sunday, so Walter took it. He left the door open behind him. I heard him laughing down there, talking to it like an old friend. Then I didn't hear anything at all.
The plate came back up the stairs by itself, licked clean. His wedding ring was on it.

June 9th, 1994
Biscuit went to sleep under the apple tree this morning. Sixteen years old. He barked at that cellar door every Sunday of his life, and it never once came near him. I buried him right there under the tree, where he liked to nap.
I won't get another dog. I can't do it again.

October 20th, 1999
My hands shake too much to carry the plate down anymore. If I don't make it to Sunday and it wakes, it can be put back down. Mother did it in '31.
Take the oil lamp from the barn and hang it in its room, down at the very bottom. Then ring Walter's bell three times. The bell is in his trunk, in the attic.
It will have to come back to its bed. It has to. Then you get out, and you don't look back.

October 23rd, 1999
Scratching all night. I thought I heard Biscuit barking out in the yard.
Silly old woman.
I'm going to sit in my chair for a while.`,
    },
    ledger: {
      title: 'Marrow House: Register of Guests, 1887', style: 'ledger',
      text: `Dec. 1st. Mr. & Mrs. Abernathy. Room 2. Paid.
Dec. 3rd. A travelling surveyor. Room 4. Paid.
Dec. 9th. <span class="scrawl">[The signature is not a name. It is a single long line, gouged so deep it tears through the page.]</span>
      Room: the cellar.
      Length of stay: <span class="scrawl">[left blank]</span>
      Payment: "Supper. Every Sunday."

Written underneath, in a shaking hand:

It came in out of the snow and asked for a room. I gave it the cellar. It promised the farm would never fail.
Lord forgive me, the harvest has never been better.
      — J. Marrow`,
    },
    newspaper: {
      title: 'Pale Creek Gazette, March 3rd, 1962', style: 'news',
      html: `<b>SEARCH FOR LOCAL FARMER CALLED OFF</b>The search for Walter Marrow, 41, of Pale Creek Road, was called off on Thursday.

Mr. Marrow has not been seen since Sunday, February 25th. His wife, Ruth, told deputies only that he "went down to the cellar."

Deputies searched the property and reported finding nothing in the cellar "except a great many dishes."`,
    },
    walter: {
      title: "A letter in Walter's trunk", style: 'hand',
      text: `Ruthie,

If you're reading this, I went down after all. I'm sorry.

It talks to me through the door now, when you're asleep. It knows my name. It knows my father's name. It says Dad is down there with it, and he's been waiting such a long time, and he's so lonely.

I know it's lying. I know.

But it sounds just like him, Ruthie.

      — W.`,
    },
    drawing: {
      title: "A child's drawing", style: 'child',
      text: `[A house. A little dog. And under the house, drawn very big, a tall thin man with a long, long smile.]

THE LODJER
HE IS HUNGRY ON SUNDAYS

by Ruthie, age 7`,
    },
    mother1931: {
      title: 'A torn page, 1931', style: 'hand',
      text: `November 1931

We missed two Sundays while Papa was sick. It came up on the third.

I did what Grandfather wrote. I hung the lamp over its bed and I rang the bell, and oh, it came running home. It came right past me in the dark. I would have been a dead thing if it had looked. I did not breathe.

It lay down in its bed like a dog called home, and it looked at the lamp, and it slept.

Put out your light when you hear it coming. Keep still. It only wants its bed.`,
    },
  };
  for (const k in NOTES) if (!NOTES[k].html) NOTES[k].html = esc(NOTES[k].text).replace(/&lt;span class="scrawl"&gt;/g, '<span class="scrawl">').replace(/&lt;\/span&gt;/g, '</span>');

  const MIMIC = [
    'Sweetpea? Where are you, honey?',
    'Come help Grandma with the plates.',
    'Robin. I can hear you breathing.',
    "Why didn't you come for Sunday supper?",
    'Ruthie? Ruthie, is that you?',
    'Here, boy. Here, Biscuit.',
    "It's so cold down here.",
    "Sweetpea... supper's getting cold.",
  ];
  const DEATHS = ['It took you down to the cellar.', 'You were late for supper.', 'It was so very hungry.', 'Sunday supper is served.'];

  // =====================================================================
  // helpers
  // =====================================================================
  const thing = (G, o) => G.add(new MH.Ent.Thing(G, o));
  const inspect = (G, x, y, z, prompt, fn, extra) =>
    thing(G, Object.assign({ x, y, z, iy: y, promptText: prompt, onUse: fn, range: 1.9 }, extra || {}));
  const note = (G, id, x, y, z, yaw, wall) =>
    thing(G, {
      x, y, z, yaw, iy: y, mesh: wall ? 'notewall' : 'note', range: 1.9,
      glint: (G2) => !G2.notesRead.includes(id),
      promptText: 'Read', onUse: (G2) => G2.readNote(id),
    });
  const pickup = (G, o) => {
    if (G.flags['picked:' + o.id]) return null;
    const { prompt, ...rest } = o;
    return thing(G, Object.assign({ iy: o.y, glint: true, range: 1.9, promptText: prompt || 'Take ' + o.name }, rest, {
      onUse: (G2, t) => {
        t.alive = false;
        G2.flags['picked:' + o.id] = true;
        MH.Audio.pickup();
        if (o.then) o.then(G2, t);
      },
    }));
  };
  const battery = (G, id, x, y, z) => pickup(G, {
    id, x, y, z, mesh: 'battery', name: 'batteries',
    then: (G2) => {
      G2.player.battery = Math.min(1, G2.player.battery + 0.55);
      G2.hint('Fresh batteries in the flashlight.', 3);
    },
  });
  const trigger = (G, x0, z0, x1, z1, fn, cond) => G.add(new MH.Ent.Trigger(G, { x0, z0, x1, z1, once: true, fn, cond }));
  // One line at a time. Forced monologues queue up behind whatever is being said;
  // optional ones are dropped if someone is already talking; urgent ones (big story
  // beats) cut off anything still queued and start straight away.
  const monologue = (G, lines, force, urgent) => {
    if (G.talking && !force && !urgent) return Promise.resolve();
    if (urgent) { G.talkGen = (G.talkGen || 0) + 1; G.talkChain = null; }
    const gen = G.talkGen || 0;
    const run = async () => {
      if ((G.talkGen || 0) !== gen) return;
      G.talking = true;
      try {
        for (const l of lines) {
          if ((G.talkGen || 0) !== gen) break;
          if (typeof l === 'number') await G.wait(l);
          else if (Array.isArray(l)) await G.say(l[0], l[1], l[2]);
          else await G.say(l);
        }
      } finally {
        if ((G.talkGen || 0) === gen) G.talking = false;
      }
    };
    G.talkChain = (G.talkChain || Promise.resolve()).then(run, run);
    return G.talkChain;
  };

  const Story = { NOTES };

  Story.envKey = (G, id) => {
    if (id === 'yard') return G.flags.epilogue ? 'morning' : 'night';
    if (id === 'house') return G.flags.blackout ? 'dark' : 'lit';
    return 'dark';
  };

  Story.applyLights = (G) => {
    const f = G.flags;
    for (const L of G.level.lights) {
      if (L.group === 'power') L.on = !f.blackout && !f.epilogue;
      if (L.group === 'car') L.on = !f.epilogue;
      if (L.group === 'attic') L.on = !f.bell;
      if (L.group === 'room0') L.on = !!f.lampHung;
    }
  };

  // =====================================================================
  // OBJECTIVES / GUIDANCE
  // =====================================================================
  Story.objective = (G) => {
    const f = G.flags, inv = G.inv, m = G.mapId;
    if (f.epilogue) return 'Say goodbye.';
    if (f.rings >= 3) return f.lodgerAsleep ? 'It\'s asleep. Get out. Don\'t look back.' : 'It\'s coming back to its bed. Get out of its way.';
    if (f.lampHung) return 'Ring the bell three times.';
    if (m === 'cellar') return 'Find its room at the very bottom. Hang the lamp.';
    if (f.blackout) {
      const need = [];
      if (!inv.has('lamp')) need.push('the oil lamp in the barn');
      if (!inv.has('bell')) need.push("Walter's bell in the attic");
      if (need.length) return 'Find ' + need.join(' and ') + '.';
      return 'Go down into the cellar.';
    }
    if (f.diaryRead) return 'Answer the phone.';
    if (f.rulesRead) return "Find out what Grandma meant. Check her bedroom.";
    if (f.inHouse) return 'Look around the house.';
    if (f.triedDoor && !f.key) return "Find Grandma's spare key.";
    return 'Get inside the house.';
  };

  Story.guideTarget = (G) => {
    const f = G.flags, inv = G.inv, m = G.mapId;
    if (m === 'yard') {
      if (f.epilogue) return null;
      if (!f.key) return [tw(4), tw(9) + 1.0];
      if (f.blackout && !inv.has('lamp')) return [tw(27), tw(10)];
      return [tw(14), tw(12)];
    }
    if (m === 'house') {
      if (!f.rulesRead) return [tw(14) + 0.3, tw(4)];
      if (!f.diaryRead) return [tw(4), tw(2) + 0.3];
      if (!f.blackout) return [tw(12), tw(8)];
      if (!inv.has('bell')) return [tw(7), tw(2)];
      if (!inv.has('lamp')) return [tw(8), tw(14)];
      return [tw(12), tw(1) + 0.6];
    }
    if (m === 'cellar') {
      if (f.rings < 3) return [tw(21), tw(19)];
      return [tw(1), tw(2)];
    }
    return null;
  };

  // =====================================================================
  // POPULATE MAPS
  // =====================================================================
  Story.populate = (G, id) => {
    G.phone = null;
    G.mannequins = [];
    if (id === 'yard') populateYard(G);
    else if (id === 'house') populateHouse(G);
    else if (id === 'attic') populateAttic(G);
    else if (id === 'cellar') populateCellar(G);
  };

  // ---------------- YARD ----------------
  function populateYard(G) {
    const f = G.flags;
    if (f.epilogue) return populateMorning(G);
    if (!f.metDog) {
      const dog = G.spawnDog(tw(15) + 0.3, tw(11) + 0.5, 'script');
      dog.scriptMode = 'sit';
      dog.yaw = Math.PI - 0.3;
      thing(G, {
        tick: (dt, G2, t) => {
          if (MH.dist(G2.player.x, G2.player.z, dog.x, dog.z) < 13) { t.alive = false; meetDog(G2, dog); }
        },
      });
    } else G.spawnDogNearPlayer();

    // front door
    thing(G, {
      x: tw(14), y: 0, z: 11 * S + 0.02, iy: 1.2, range: 2.1,
      promptText: (G2) => (G2.flags.key ? 'Go inside' : 'Front door'),
      onUse: frontDoor,
    });
    if (!f.key) {
      pickup(G, { id: 'key', x: tw(4), y: 1.6, z: tw(9) + 0.5, mesh: 'key', prompt: 'Look inside the birdhouse', range: 2.2, then: gotKey });
    }
    inspect(G, tw(4), 0.5, tw(10) - 0.55, 'Look at the little grave', graveInspect, { range: 2.1 });
    inspect(G, tw(14) + 1.05, 1.1, tw(31) - 0.3, 'Look at the car', (G2) => {
      if (!G2.notesRead.includes('letter')) G2.readNote('letter');
      else monologue(G2, ["My car. The engine's dead and the snow's getting deeper.", "I'm not going anywhere tonight."]);
    }, { range: 2.2 });
    inspect(G, tw(13), 1.2, tw(29), 'Look in the mailbox', (G2) => monologue(G2, [
      'MARROW. The little flag is up.',
      "There's one envelope inside, addressed to me in Grandma's handwriting.",
      "Postmarked October 23rd. It's empty.",
    ]));
    inspect(G, tw(6), 0.9, tw(17), 'Look down the well', (G2) => monologue(G2, [
      "I can't see the bottom.", 'I dropped a pebble in.', 0.8, 'I never heard it land.',
    ]), { range: 2.3 });
    inspect(G, tw(25), 1.6, tw(19), 'Look at the scarecrow', (G2) => monologue(G2, [
      "It's wearing a man's Sunday suit.", "The rest of it is rotten through, but the suit looks... pressed. Clean.",
    ]), { range: 2.6 });
    inspect(G, tw(14), 0.8, tw(33) - 0.6, 'The road back', (G2) => monologue(G2, [
      'A pine came down across the road behind me.', "There's no way back to town tonight.",
    ]), { range: 2.4 });
    inspect(G, tw(24) - 0.2, 1.4, tw(12) + 0.1, 'Look at the barn', (G2) => monologue(G2, [
      "Grandpa's barn. Nobody's farmed this land since before I was born.",
    ]), { range: 2.0 });

    // barn
    if (!G.inv.has('lamp') && !f.lampHung) {
      pickup(G, { id: 'lamp', x: 42.98, y: 1.56, z: tw(10), mesh: 'lampdark', name: 'the oil lamp', then: gotLamp });
    }
    battery(G, 'bat_barn', tw(26) + 0.35, 0.96, 10.95);

    if (f.blackout) G.spawnLodger(0, 0, { respawnIn: 9 + Math.random() * 6 });
    if (!f.sawHouse) {
      trigger(G, 0, 0, 60, tw(25), (G2) => {
        G2.flags.sawHouse = true;
        monologue(G2, ["Grandma's house.", 'It looks smaller than I remember.']);
      });
    }
  }

  async function meetDog(G, dog) {
    G.flags.metDog = true;
    dog.bark(2);
    await G.wait(0.4);
    dog.state = 'follow';
    await monologue(G, ['A dog?', 1.2, 'Hey... hey there, buddy. Where did you come from?'], true);
    G.hint('Walk up to the dog and press [E] to pet him.', 7);
  }

  async function frontDoor(G) {
    const f = G.flags;
    if (!f.key) {
      MH.Audio.locked([tw(14), 1, 11 * S]);
      f.triedDoor = true;
      await monologue(G, ['Locked.', 'Grandma always hid a spare key out here somewhere...'], true);
      G.setObjective();
      if (f.dogTag) G.hint('Press [Q] to whistle. Biscuit will lead you somewhere useful.', 7);
      return;
    }
    MH.Audio.doorOpen([tw(14), 1, 11 * S]);
    G.goto('house', 'foyer');
  }

  async function gotKey(G) {
    G.flags.key = true;
    G.inv.add('key');
    G.setObjective();
    await monologue(G, ['A key, tucked inside the birdhouse.', 'Right where she always kept it.'], true);
    if (!G.flags.yardGhost) {
      G.flags.yardGhost = true;
      await G.wait(1.5);
      const P = G.player;
      const app = G.add(new MH.Ent.Apparition(G, {
        x: tw(6) + 0.4, z: tw(3) + 0.3, yaw: 0, life: 14, vanishDist: 6, stareMax: 1.6,
        onSeen: (G2) => { G2.scare(0.25); if (G2.dog) MH.Audio.growl([G2.dog.x, 0.5, G2.dog.z], 2); },
        onGone: (G2) => monologue(G2, ['...Hello?', 1, 'Is someone out there?']),
      }));
      app.yaw = MH.yawTo(app.x, app.z, P.x, P.z);
    }
  }

  async function graveInspect(G) {
    if (G.flags.diaryRead) {
      await monologue(G, [
        'GOOD BOY.', "Someone's brushed the snow off the little cross.",
        'The snow on the grave is pressed flat, in the shape of a curled-up dog.',
      ], true);
    } else {
      await monologue(G, ['A little wooden cross under the apple tree.', 'Someone carved GOOD BOY into it. The name underneath has worn away.'], true);
    }
    if (G.dog && MH.dist(G.dog.x, G.dog.z, G.player.x, G.player.z) < 8) MH.Audio.whine([G.dog.x, 0.5, G.dog.z]);
  }

  async function gotLamp(G) {
    G.inv.add('lamp');
    G.player.lamp = true;
    G.setObjective();
    await monologue(G, ["The oil lamp. There's still oil in it.", 'Lit. It throws light everywhere... it will see me coming a mile off.'], true);
    G.hint('The lamp lights your way, but it makes you easier to spot.', 6);
    G.checkpoint();
  }

  // ---------------- EPILOGUE ----------------
  function populateMorning(G) {
    G.player.flashOn = false;
    G.player.lamp = false;
    G.inv.clear();
    const ax = tw(14), az = tw(12) + 0.3, bx = tw(4) + 0.2, bz = tw(10) + 0.3;
    const n = Math.floor(MH.dist(ax, az, bx, bz) / 0.42);
    const yaw = MH.yawTo(ax, az, bx, bz);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const bend = Math.sin(t * Math.PI) * 2.2;
      const x = MH.lerp(ax, bx, t) + Math.cos(yaw) * ((k % 2) * 0.16 - 0.08) + Math.cos(yaw) * bend;
      const z = MH.lerp(az, bz, t) - Math.sin(yaw) * ((k % 2) * 0.16 - 0.08) - Math.sin(yaw) * bend;
      thing(G, { x, y: 0.02, z, yaw: yaw + Math.PI, mesh: 'pawprint' });
    }
    thing(G, { x: tw(4), y: 0.52, z: tw(10) - 0.575, mesh: 'collar' });
    inspect(G, tw(4), 0.5, tw(10) - 0.5, 'Say goodbye', (G2, t) => { t.alive = false; Story.finale(G2); }, { range: 2.3 });
    inspect(G, tw(14) + 1.05, 1.1, tw(31) - 0.3, 'Look at the car', (G2) => monologue(G2, ["The battery's dead. Someone will come up the road eventually."]), { range: 2.2 });
  }

  // ---------------- HOUSE ----------------
  function populateHouse(G) {
    const f = G.flags;
    G.spawnDogNearPlayer();
    for (const L of G.level.lights) {
      if (!L.fixture) continue;
      thing(G, { x: L.x, y: 2.7, z: L.z, mesh: L.fixture, tick: (dt, G2, t) => { t.tint = [1, 1, 1, L.on ? 1.5 * (L.intensity / L.base) : 0]; } });
    }
    thing(G, {
      x: tw(8), y: 0, z: 15 * S - 0.01, yaw: Math.PI, mesh: 'frontdoor', iy: 1.2, range: 2.1,
      promptText: 'Go outside', onUse: (G2) => { MH.Audio.doorOpen([tw(8), 1, 15 * S]); G2.goto('yard', 'porch'); },
    });
    // cellar door
    thing(G, {
      x: tw(12), y: 0, z: 1 * S + 0.012, mesh: (G2) => (G2.flags.blackout ? 'cellarhole' : 'cellardoor'), iy: 1.1, range: 2.1,
      promptText: (G2) => (G2.flags.blackout && G2.inv.has('lamp') && G2.inv.has('bell') ? 'Go down into the cellar' : 'Cellar door'),
      onUse: cellarDoor,
    });
    thing(G, { x: tw(12), y: 0, z: 1 * S + 0.02, mesh: (G2) => (G2.flags.blackout ? 'chainbroken' : null) });
    thing(G, { x: tw(12) - 0.62, y: 0.25, z: 1 * S + 0.015, mesh: 'scratch' });
    thing(G, { x: tw(12) + 0.66, y: 0.9, z: 1 * S + 0.015, mesh: 'scratch', scale: 0.8 });
    // attic
    thing(G, {
      x: tw(7), y: 2.7, z: tw(1) - 0.25, mesh: (G2) => (G2.flags.atticOpen ? 'ladder' : 'hatch'), iy: 1.7, range: 2.3,
      promptText: (G2) => (G2.flags.atticOpen ? 'Climb into the attic' : 'Attic hatch'),
      onUse: (G2) => {
        if (!G2.flags.atticOpen) monologue(G2, ["The attic hatch won't come down.", 'Something is holding it shut from the other side.'], true);
        else { MH.Audio.creak([tw(7), 2, tw(1)], 0.15); G2.goto('attic', 'ladder'); }
      },
    });
    // pages
    note(G, 'rules', 23.25, 1.35, tw(4) + 0.1, -Math.PI / 2, true);
    note(G, 'grocery', tw(12) - 0.35, 0.77, tw(3) + 0.25, 0.4);
    note(G, 'diary', 6.45, 0.61, 1.8, 0.25);
    note(G, 'ledger', 20.55, 0.785, tw(8) + 0.25, -Math.PI / 2 + 0.2);
    inspect(G, tw(11) + 0.15, 1.44, tw(7) - 0.68, 'Read the clipping', (G2) => G2.readNote('newspaper'));
    // things to look at
    inspect(G, tw(9) - 0.7, 1.55, tw(4), 'Look at the calendar', (G2) => monologue(G2, [
      'A calendar for 1999. Every Sunday is circled in red, with SUPPER written inside.', 'The circles stop after October 17th.',
    ], true));
    inspect(G, 4.35, 0.75, tw(9), "Grandma's chair", (G2) => monologue(G2, [
      "Grandma's chair. There's still a dent in the cushion.", 'This is where they found her.',
    ], true));
    thing(G, {
      x: 1.84, y: 1.3, z: tw(9) - 0.5, yaw: Math.PI / 2, mesh: 'photo', iy: 1.35, range: 1.9, glint: (G2) => !G2.flags.photoSeen,
      promptText: 'Look at the photo', onUse: photo,
    });
    thing(G, {
      x: 1.84, y: 1.3, z: tw(9) + 0.55, yaw: Math.PI / 2, mesh: 'musicbox', iy: 1.35, range: 1.9,
      promptText: 'Music box', onUse: (G2) => monologue(G2, ["Grandma's music box. It's playing all by itself.", "The key isn't even turning."], true),
      tick: (dt, G2, t) => {
        const d = MH.dist(G2.player.x, G2.player.z, t.x, t.z);
        if (!t.box && d < 5.5) t.box = MH.Audio.musicBox([t.x, t.y, t.z]);
        if (t.box && d > 9) { t.box.stop(); t.box = null; }
      },
      onDestroy: (G2, t) => { if (t.box) t.box.stop(); },
    });
    const tv = thing(G, {
      x: tw(4), y: 0.56, z: 11.02, mesh: (G2, t) => (t.on ? 'tvscreen' : null), iy: 0.8, range: 2.2, on: !!f.tvOn && !f.blackout,
      promptText: (G2, t) => (t.on ? 'Turn off the TV' : 'Television'),
      onUse: (G2, t) => {
        if (t.on) {
          t.on = false;
          MH.Audio.click();
          monologue(G2, ['There.'], true);
        } else monologue(G2, ["Grandma's old television."], true);
      },
      tick: (dt, G2, t) => {
        if (t.on && G2.flags.blackout) t.on = false;
        if (t.on && !t.snd) t.snd = MH.Audio.tvStatic([t.x, 0.8, t.z]);
        if (!t.on && t.snd) { t.snd.stop(); t.snd = null; }
        if (t.on) G2.dynLights.push({ x: t.x, y: 0.9, z: t.z + 0.6, col: [0.55, 0.62, 0.85], radius: 4.5, intensity: 0.5 + Math.random() * 0.4 });
      },
      onDestroy: (G2, t) => { if (t.snd) t.snd.stop(); },
    });
    inspect(G, 27, 0.6, tw(7) - 0.3, 'Look in the bathtub', (G2) => monologue(G2, [
      "Someone ran a bath. The water's black and still, and ice cold.", "I'm not putting my hand in there.",
    ], true), { range: 2.1 });
    inspect(G, tw(15), 1.45, tw(7) - 0.55, 'Look in the mirror', mirror);
    inspect(G, 2.2, 1.2, tw(4), "Grandma's wardrobe", (G2) => monologue(G2, [
      'Her Sunday dresses, all in a row.', 'They still smell like her.',
    ], true));
    inspect(G, 10.75, 1.5, tw(5), "Grandpa's clock", (G2) => monologue(G2, G2.flags.blackout
      ? ["The clock stopped when the lights went out.", 'Seven fourteen.']
      : ["Grandpa's clock. Still keeping time after all these years."], true));
    inspect(G, tw(12) - 0.4, 0.2, 1 * S + 0.5, 'Look at the plates', (G2) => monologue(G2, [
      'Three plates of food by the cellar door, rotting.', "Like somebody kept making Sunday supper... and nobody came to take it.",
    ], true));
    inspect(G, tw(18), 1.2, tw(2), 'Look at the shelves', (G2) => monologue(G2, ['Preserves. Dozens of jars. Some of them are dated before the war.'], true));
    battery(G, 'bat_pantry', tw(18) - 0.35, 0.63, 1.8);
    battery(G, 'bat_study', 20.45, 0.785, 13.4);
    battery(G, 'bat_bed', 7.05, 0.91, 8.72);

    // the phone
    const phone = thing(G, {
      x: 20.55, y: 0.78, z: tw(8) - 0.4, yaw: -Math.PI / 2, mesh: 'phone', iy: 0.85, range: 1.9, ringing: false, ringT: 0,
      promptText: (G2, t) => (t.ringing ? 'Answer the phone' : 'Telephone'),
      onUse: (G2, t) => {
        if (t.ringing) answerPhone(G2, t);
        else monologue(G2, G2.flags.blackout ? ['Dead. Not even a hum.'] : ['No dial tone. Just a faint hiss, like wind.'], true);
      },
      tick: (dt, G2, t) => {
        if (!t.ringing) return;
        t.ringT -= dt;
        t.total = (t.total || 0) + dt;
        if (t.ringT <= 0) { MH.Audio.phoneRing([t.x, 0.9, t.z]); t.ringT = 4; G2.noise(t.x, t.z, 4); }
        if (t.total > 45 && G2.state === 'play') { t.ringing = false; blackout(G2, true); }
      },
    });
    G.phone = phone;
    thing(G, { x: 20.55, y: 0.87, z: tw(8) - 0.4, yaw: -Math.PI / 2, mesh: (G2) => (G2.phone && G2.phone.offHook ? null : 'handset') });
    if (f.diaryRead && !f.blackout) phone.ringing = true;

    // sounds
    if (!f.blackout) {
      const clock = MH.Audio.clock([10.75, 1.6, tw(5)]);
      thing(G, { onDestroy: () => clock.stop(), tick: (dt, G2) => { if (G2.flags.blackout) clock.stop(); } });
      MH.Audio.startHum();
    } else MH.Audio.stopHum();

    if (f.blackout) G.spawnLodger(0, 0, { respawnIn: 7 + Math.random() * 6 });

    // scripted scares
    if (!f.knocked && !f.blackout) {
      trigger(G, 16.2, 1.5, 21.3, 4.6, async (G2) => {
        G2.flags.knocked = true;
        await G2.wait(0.6);
        MH.Audio.knock([tw(12), 1.2, 1.0], 2);
        if (G2.dog) { G2.dog.bark(2); setTimeout(() => G2.dog && MH.Audio.growl([G2.dog.x, 0.5, G2.dog.z], 2.2), 700); }
        await G2.wait(1.4);
        monologue(G2, ['...Hello?', 1.5, 'Two knocks. From the other side of the cellar door.'], true);
      });
    }
    if (!f.tvOn && !f.blackout) {
      trigger(G, 1.5, 10.6, 9, 19.4, async (G2) => {
        await G2.wait(1.2);
        if (G2.flags.blackout) return;
        G2.flags.tvOn = true;
        tv.on = true;
        G2.scare(0.2);
        await G2.wait(0.8);
        monologue(G2, ['...I didn\'t touch that.'], true);
      });
    }
    if (!f.corridorGhost && !f.blackout) {
      trigger(G, 11.6, 16.5, 13.5, 18, (G2) => {
        G2.flags.corridorGhost = true;
        G2.add(new MH.Ent.Apparition(G2, {
          x: tw(15), z: tw(11), yaw: Math.PI / 2, life: 7, vanishDist: 5, stareMax: 1.3,
          onSeen: (G3) => { G3.scare(0.4); },
          onGone: (G3) => {
            const L = G3.level.lights.find((l) => l.id === 'corr');
            if (L) { L.on = false; setTimeout(() => { if (!G3.flags.blackout) L.on = true; }, 900); }
            if (G3.dog) MH.Audio.growl([G3.dog.x, 0.5, G3.dog.z], 1.8);
          },
        }));
      });
    }
  }

  async function cellarDoor(G) {
    const f = G.flags;
    if (!f.blackout) {
      await monologue(G, [
        'The cellar door. Chained shut and padlocked.',
        "The wood is bowed outward, like something's been leaning on it from the other side.",
      ], true);
      return;
    }
    if (G.inv.has('lamp') && G.inv.has('bell')) {
      MH.Audio.creak([tw(12), 1, 1.5], 0.2);
      G.goto('cellar', 'stairs');
      return;
    }
    await monologue(G, ['The chain snapped clean through. Cold air is breathing up out of the dark.', "I'm not going down there without the lamp and the bell."], true);
  }

  async function photo(G) {
    G.flags.photoSeen = true;
    await monologue(G, ["A faded polaroid. Grandma, laughing, with a scruffy golden dog. One of his ears flops over.", "On the back: 'Me & Biscuit, Summer 1982.'"], true);
    if (G.flags.metDog) {
      await G.wait(0.6);
      await monologue(G, ['That\'s the same dog.', 'Same crooked ear.', 'That was seventeen years ago.'], true);
    }
  }

  async function mirror(G) {
    await monologue(G, ['I look exhausted.'], true);
    if (!G.flags.mirrorScare) {
      G.flags.mirrorScare = true;
      await G.wait(0.5);
      G.flickerFlash(0.6);
      MH.Audio.noise({ type: 'bandpass', f: 700, q: 2, dur: 0.8, a: 0.1, gain: 0.1 });
      await monologue(G, ['For a second I thought something moved behind me.'], true);
    }
  }

  async function answerPhone(G, phone) {
    const f = G.flags;
    phone.ringing = false;
    phone.offHook = true;
    f.phoneAnswered = true;
    G.lock(true);
    MH.Audio.click();
    await G.lookAt(phone.x, 0.9, phone.z, 4);
    await G.wait(1.0);
    const v = async (txt, dur) => {
      MH.Audio.voice(null, dur * 0.8, false, true);
      await G.say(txt, dur, 'phone');
    };
    await v('Sweetpea? Is that you?', 2.6);
    await v("It's Grandma, honey. I'm down in the cellar.", 3.2);
    await v("It's so cold down here. Won't you come and let me out?", 3.8);
    await G.wait(1.2);
    await v('...Sweetpea?', 2.2);
    await G.wait(1.3);
    MH.Audio.voice(null, 2.2, true, false);
    G.shake(0.5);
    G.say("YOU'RE LATE FOR SUPPER.", 2.6, 'deep');
    G.scare(0.5);
    await G.wait(1.8);
    phone.offHook = false;
    await blackout(G, false);
  }

  async function blackout(G, missed) {
    const f = G.flags;
    if (f.blackout) return;
    G.lock(true);
    f.blackout = true;
    f.atticOpen = true;
    Story.applyLights(G);
    G.setEnv('dark');
    MH.Audio.powerDown();
    if (missed) await G.say('The phone stopped ringing.', 2.5);
    await G.wait(1.6);
    MH.Audio.chainBreak([tw(12), 1.2, 1.2]);
    G.shake(0.4);
    G.scare(0.45);
    if (G.dog) { G.dog.bark(4); }
    await G.wait(1.2);
    const lod = G.spawnLodger(tw(12), tw(1) + 0.5, { state: 'wander' });
    lod.pause = 6;
    G.lock(false);
    await monologue(G, [
      '...Rule three.', 'If you hear me calling from downstairs... it is not me.', 1,
      "It's out. The diary said: the lamp from the barn, the bell from the attic.", 'I have to put it back to sleep.',
    ], true, true);
    G.setObjective();
    G.hint("It sees light and it hears running. [F] flashlight. [C] crouch. Close doors behind you.", 9);
    G.checkpoint();
  }

  // ---------------- ATTIC ----------------
  function populateAttic(G) {
    const f = G.flags;
    thing(G, { x: tw(2), y: 0.01, z: tw(5), mesh: 'hole' });
    thing(G, { x: tw(2), y: 0, z: tw(5), iy: 0.4, range: 2.0, promptText: 'Climb down', onUse: (G2) => { MH.Audio.creak([tw(2), 0.5, tw(5)], 0.12); G2.goto('house', 'attic'); } });
    const spots = [[6, 2], [8, 7], [10, 3], [12, 7], [7, 4], [13, 3]];
    G.mannequins = spots.map(([i, j], k) => G.add(new MH.Ent.Mannequin(G, { x: tw(i), z: tw(j), yaw: k * 1.3, covered: k % 2 === 1 })));
    f.atticMove = !f.bell;
    for (const L of G.level.lights) {
      if (L.fixture) thing(G, { x: L.x, y: 2.2, z: L.z, mesh: L.fixture, tick: (dt, G2, t) => { t.tint = [1, 1, 1, L.on ? 1.5 * (L.intensity / L.base) : 0]; } });
    }
    if (!f.bell) {
      thing(G, { x: 23.62, y: 0.6, z: tw(5), iy: 0.6, range: 1.9, glint: true, promptText: "Open Walter's trunk", onUse: trunk });
    }
    inspect(G, tw(8), 1.35, 1 * S + 0.08, 'Look at the drawing', (G2) => G2.readNote('drawing'));
    inspect(G, tw(9), 0.7, tw(9) + 0.2, 'Look in the crib', (G2) => monologue(G2, ['An old crib. There\'s a baby blanket inside, folded very neatly.', 'Someone embroidered a name on it. It\'s been unpicked.'], true));
    inspect(G, tw(3), 0.8, tw(2), 'Rocking horse', (G2) => monologue(G2, ["Mom's rocking horse. Or Grandma's. It's older than both of them."], true));
    inspect(G, tw(11), 1.0, 1 * S + 0.1, 'Look at the portrait', (G2) => monologue(G2, ['Josiah Marrow, 1889.', "Someone scratched his face out. Hard."], true));
    battery(G, 'bat_attic', tw(9), 0.61, tw(6));
  }

  async function trunk(G, t) {
    t.alive = false;
    const f = G.flags;
    MH.Audio.creak([t.x, 0.6, t.z], 0.15);
    G.inv.add('bell');
    f.bell = true;
    MH.Audio.pickup();
    await G.readNote('walter');
    f.atticMove = false;
    // the bulb pops
    Story.applyLights(G);
    MH.Audio.noise({ type: 'highpass', f: 3000, dur: 0.08, gain: 0.3, pos: [tw(8), 1.9, tw(5)] });
    MH.Audio.tone({ f: 2400, dur: 0.1, gain: 0.05 });
    // the dress forms gather behind you
    const P = G.player;
    const back = P.yaw + Math.PI;
    G.mannequins.forEach((m, k) => {
      const a = back + (k - (G.mannequins.length - 1) / 2) * 0.42;
      const d = 1.7 + (k % 2) * 0.5;
      const x = P.x - Math.sin(a) * d, z = P.z - Math.cos(a) * d;
      if (G.level.walkableAt(x, z, { ignoreBlock: true })) {
        [m.x, m.z] = G.level.collide(x, z, 0.3);
        m.yaw = MH.yawTo(m.x, m.z, P.x, P.z);
      }
      m.frozen = true;
    });
    await G.say("Walter's bell.", 2.2);
    G.setObjective();
    thing(G, {
      tick: (dt, G2, th) => {
        if (G2.mannequins.some((m) => MH.Ent.inView(G2, m.x, 1.2, m.z, 0.8) && MH.dist(m.x, m.z, G2.player.x, G2.player.z) < 3.5)) {
          th.alive = false;
          G2.scare(0.7);
          monologue(G2, [0.6, "...They weren't there before.", 'Grandma, what did you do to this house?'], true);
        }
      },
    });
    G.checkpoint();
  }

  // ---------------- CELLAR ----------------
  const HOOK_X = 35.1;
  function populateCellar(G) {
    const f = G.flags;
    const dog = G.spawnDog(tw(2) + 0.3, tw(3), 'follow');
    dog.yaw = MH.yawTo(dog.x, dog.z, G.player.x, G.player.z);
    thing(G, {
      x: tw(1), y: 1.0, z: tw(1) - 0.2, iy: 1.1, range: 2.2,
      promptText: (G2) => (G2.flags.rings >= 3 ? 'Get out' : 'Go back upstairs'),
      onUse: (G2) => {
        if (G2.flags.rings >= 3) Story.escape(G2);
        else G2.goto('house', 'cellar');
      },
    });
    // the hook hangs over the foot of its bed
    thing(G, { x: HOOK_X, y: 2.5, z: tw(19), mesh: 'hookchain' });
    thing(G, {
      x: HOOK_X, y: 1.58, z: tw(19), iy: 1.7, range: 2.6,
      mesh: (G2) => (G2.flags.lampHung ? 'lamp' : null),
      enabled: (G2) => !(G2.flags.rings >= 3),
      promptText: (G2) => {
        if (!G2.flags.lampHung) return 'Hang the lamp on the hook';
        return 'Ring the bell (' + (G2.flags.rings || 0) + '/3)';
      },
      onUse: hook,
    });
    note(G, 'mother1931', tw(10), 0.01, tw(4) + 0.1, 0.6);
    inspect(G, tw(10), 1.2, tw(5) + 0.5, 'Look at the scratches', (G2) => monologue(G2, [
      'Scratches in the dirt. Tally marks.', 'Hundreds of them. Thousands.', 'Grouped in sevens.',
    ], true));
    thing(G, { x: tw(6), y: 0, z: tw(8), yaw: 0.7, mesh: 'hat', iy: 0.2, range: 1.8, promptText: 'A hat', onUse: (G2) => monologue(G2, [
      "A man's Sunday hat, grey with dust.", 'Inside the band, in faded ink: W. MARROW.', 1, 'Grandpa.',
    ], true) });
    inspect(G, tw(19), 1.0, tw(9), 'Look at the plates', (G2) => monologue(G2, [
      'Plates. Hundreds of plates, stacked to the ceiling.', 'Every single one licked clean.', 'Some of them are older than the house.',
    ], true), { range: 2.5 });
    inspect(G, tw(13) + 0.75, 0.3, tw(16), 'Look at the bones', (G2) => monologue(G2, ["Bones. Small ones, mostly. I don't want to know what from."], true));
    inspect(G, tw(22) + 0.9, 0.6, tw(19) + 0.55, 'Look at the bed', (G2) => monologue(G2, [
      'An iron bed, black with rot.', 'The mattress is pressed down in the shape of something very long, and very thin.',
    ], true), { range: 2.2 });
    inspect(G, tw(21), 1.78, tw(17) - 0.62, 'Read the plaque', (G2) => monologue(G2, ['A little brass plaque, nailed to the wall.', 'ROOM 0.'], true));
    inspect(G, tw(24) + 0.6, 1.4, tw(21), 'Look out the window', (G2) => monologue(G2, ["A window. There's nothing behind the glass but packed earth.", 'Somebody hung curtains.'], true));
    battery(G, 'bat_cellar', tw(2), 0.81, tw(4));
    if (!f.sawRoom0) {
      trigger(G, 18 * S, 17 * S, 25 * S, 22 * S, (G2) => {
        G2.flags.sawRoom0 = true;
        monologue(G2, ['Room zero.', "It's a guest room.", "It's a guest room, down here in the dirt."], true);
      });
    }
    if (f.rings >= 3) {
      if (f.lodgerAsleep) {
        const l = G.spawnLodger(tw(22), tw(19), { state: 'sleep' });
        l.bedCenter = [36.08, 0.62, tw(19)];
      } else spawnReturning(G, 3);
    }
  }

  function spawnReturning(G, delay) {
    const l = G.spawnLodger(tw(3), tw(3), { state: 'return', respawnIn: delay || 0.1, noRelocate: true });
    l.afterRespawn = 'return';
    l.bedPos = [tw(22), tw(19)];
    l.onBed = () => {
      l.bedCenter = [36.08, 0.62, tw(19)];
      G.flags.lodgerAsleep = true;
      G.setObjective();
      monologue(G, ["It's lying down.", "It's... going back to sleep.", 'Now get out. Don\'t look back.'], true, true);
    };
    // it comes down the stairs, not from wherever it likes
    l.respawn = () => {
      if (G.flags.lodgerAsleep) return;
      const P = G.player;
      const spots = [[tw(3), tw(2)], [tw(4), tw(3)], [tw(2), tw(3)], [tw(3), tw(6)]];
      const s = spots.find(([x, z]) => MH.dist(x, z, P.x, P.z) > 6) || spots[0];
      l.x = s[0]; l.z = s[1];
      l.hidden = false; l.active = true; l.state = 'return'; l.path = null; l.seeT = 0;
    };
    return l;
  }

  async function hook(G, t) {
    const f = G.flags;
    if (!f.lampHung) {
      if (!G.inv.has('lamp')) { monologue(G, ['An iron hook in the ceiling, black with old soot.'], true); return; }
      G.inv.delete('lamp');
      G.player.lamp = false;
      f.lampHung = true;
      f.rings = 0;
      Story.applyLights(G);
      MH.Audio.tone({ type: 'triangle', f: 300, dur: 0.2, gain: 0.08 });
      G.setObjective();
      await monologue(G, ['There.', 'Now the bell. Three times.'], true);
      return;
    }
    if (f.ringing) return;
    f.ringing = true;
    f.rings = (f.rings || 0) + 1;
    MH.Audio.bell([G.player.x, 1.4, G.player.z]);
    G.shake(0.25);
    G.setObjective();
    const n = f.rings;
    await G.wait(1.6);
    f.ringing = false;
    if (n === 1) {
      MH.Audio.shriek([tw(2), 3, tw(1)], false);
      monologue(G, ['Something screamed.', 'Far away. Up in the house.'], true);
    } else if (n === 2) {
      MH.Audio.thud([tw(3), 2, tw(2)], 0.6);
      monologue(G, ["It's coming."], true);
    } else {
      MH.Audio.doorClose([tw(1), 2, tw(1)], true);
      G.scare(0.4);
      spawnReturning(G, 2.5);
      G.setObjective();
      G.checkpoint();
      monologue(G, ["It's on the stairs.", "It's coming back to its bed... and I'm standing in its room."], true, true);
      G.hint('Get out of its way. Put out your light [F], crouch [C], and keep still. Let it pass.', 10);
    }
  }

  // =====================================================================
  // BITS AND PIECES
  // =====================================================================
  Story.petDog = (G) => {
    const f = G.flags;
    if (!f.dogTag) {
      f.dogTag = true;
      monologue(G, [
        "Hey, good boy. You're freezing... no. You're not even cold.",
        "His tag says BISCUIT. 'If found, return to Ruth Marrow, Pale Creek Road.'",
        'Grandma had a dog called Biscuit when I was little.', 'She must have named this one after him.',
      ], true).then(() => {
        G.hint('Press [Q] to whistle. Biscuit will lead you somewhere useful.', 8);
        G.setObjective();
      });
      return;
    }
    const lines = G.flags.diaryRead
      ? ['...Who are you, boy?', "You're not afraid of it, are you?", 'Good boy. Stay close.']
      : ['Good boy.', 'Stay close, okay?', "You don't like it here either, huh?", 'Good boy, Biscuit.'];
    if (!G.talking) G.say(MH.pick(lines), 2.2);
  };

  Story.whistle = (G) => {
    const dog = G.dog;
    if (!dog || dog.hidden || dog.state === 'script' || dog.state === 'gone') return;
    const target = Story.guideTarget(G);
    if (target) {
      dog.startGuide(target);
      setTimeout(() => dog.bark(1), 350);
    } else {
      setTimeout(() => dog.bark(1), 350);
      dog.anim.tilt = 0.5;
    }
  };

  Story.mimic = (G, lod) => {
    const line = MH.pick(MIMIC);
    MH.Audio.voice([lod.x, 1.9, lod.z], Math.max(1.5, line.length * 0.06), false, false);
    G.say(line, Math.max(2.6, line.length * 0.07), 'voice');
  };

  Story.deathText = () => MH.pick(DEATHS);

  Story.onRead = async (G, id) => {
    const f = G.flags;
    if (id === 'rules' && !f.rulesRead) {
      f.rulesRead = true;
      G.setObjective();
      await monologue(G, ['What is this, Grandma?', 'What did you keep down there?'], true);
      G.checkpoint();
    } else if (id === 'diary' && !f.diaryRead) {
      f.diaryRead = true;
      await monologue(G, ["Biscuit died in '94.", "She said she'd never get another dog.", 1.0, "Then whose dog is—"], true, true);
      if (G.phone) { G.phone.ringing = true; G.phone.ringT = 0; G.phone.total = 0; }
      G.setObjective();
      if (G.dog) MH.Audio.whine([G.dog.x, 0.5, G.dog.z]);
    } else if (id === 'ledger' && !f.ledgerRead) {
      f.ledgerRead = true;
      monologue(G, ['1887. It\'s been down there for over a hundred years.'], true);
    } else if (id === 'walter') {
      // handled by the trunk sequence
    } else if (id === 'mother1931' && !f.motherRead) {
      f.motherRead = true;
      monologue(G, ['Put out your light. Keep still.', 'It only wants its bed.'], true);
    } else if (id === 'letter' && !f.letterRead) {
      f.letterRead = true;
      monologue(G, ['"Keep the Sunday supper."', 'Today is Sunday.'], true);
    }
  };

  // =====================================================================
  // MAP ENTRY
  // =====================================================================
  Story.onEnter = async (G, id) => {
    const f = G.flags;
    G.setObjective(null, true);
    if (id === 'yard') {
      if (f.epilogue) {
        G.setObjective();
        await monologue(G, [1.5, 'Morning.', 'The snow stopped sometime before dawn.'], true);
        return;
      }
      if (!f.started) {
        f.started = true;
        if (!G.notesRead.includes('letter')) G.notesRead.push('letter');
        await monologue(G, [1.2, "The car won't make it up the drive in this snow.", "I'll walk the rest of the way."], true);
        G.setObjective();
        G.hint('WASD to move, mouse to look. [TAB] opens your journal. The lawyer\'s letter is in there.', 8);
      } else if (f.blackout && !f.yardDark) {
        f.yardDark = true;
        await monologue(G, ['The porch light is out.', "Somewhere out there in the snow, something is walking."], true);
      }
    } else if (id === 'house') {
      if (!f.inHouse) {
        f.inHouse = true;
        G.setObjective();
        await monologue(G, [0.8, "The lights are on. Who's been paying the electric?", 'It smells like wet earth in here.'], true);
      }
    } else if (id === 'attic') {
      if (!f.atticSeen) {
        f.atticSeen = true;
        await monologue(G, ["Biscuit won't come up the ladder.", "Stay there, boy. I'll be quick."], true);
        if (!f.bell) await monologue(G, ["Grandma's dress forms. God, I hate these things."], true);
      }
    } else if (id === 'cellar') {
      if (!f.cellarSeen) {
        f.cellarSeen = true;
        G.setObjective();
        await monologue(G, [0.8, "Biscuit? You're already down here.", 'How did you get past me, boy?'], true);
        G.hint('This goes down much further than any cellar should. [Q] to have Biscuit lead the way.', 7);
      }
    }
  };

  // =====================================================================
  // THE ENDING
  // =====================================================================
  Story.escape = async (G) => {
    if (G.flags.escaping) return;
    const f = G.flags;
    f.escaping = true;
    G.talkGen = (G.talkGen || 0) + 1;
    G.talkChain = null;
    G.talking = false;
    G.lock(true);
    G.state = 'cutscene';
    const P = G.player;
    const lod = G.lodger;
    if (lod && !f.lodgerAsleep) lod.hide(9999);
    const dog = G.dog;
    // climb a few steps, then look back down
    P.x = tw(1); P.z = tw(1) + 0.3;
    P.pitch = 0;
    P.eyeBoost = 0.45;
    if (dog) {
      dog.hidden = false;
      dog.state = 'script';
      dog.scriptMode = 'sit';
      dog.x = tw(1) + 0.2; dog.z = tw(3) - 0.2;
      dog.yaw = MH.yawTo(dog.x, dog.z, P.x, P.z);
    }
    await G.lookAt(tw(1) + 0.2, 0.4, tw(3), 3);
    await G.wait(0.6);
    await G.say('Biscuit! Come on, boy. Come on!', 2.6);
    if (dog) { dog.bark(1); dog.anim.happy = 1.5; }
    await G.wait(1.6);
    await G.say('Biscuit...?', 2);
    if (dog) {
      dog.scriptMode = null;
      dog.state = 'goto';
      dog.gotoTarget = [tw(5), tw(3)];
      dog.gotoSpeed = 1.6;
    }
    await G.wait(2.8);
    if (dog) {
      dog.state = 'script';
      dog.scriptMode = 'stand';
      dog.yaw = MH.yawTo(dog.x, dog.z, P.x, P.z);
      dog.anim.happy = 1.4;
    }
    await G.wait(1.4);
    if (dog) { dog.state = 'goto'; dog.gotoTarget = [tw(8), tw(3)]; dog.gotoSpeed = 1.8; }
    await G.wait(2.4);
    if (dog) dog.hidden = true;
    MH.Audio.bark([tw(10), 1, tw(4)], 2);
    await G.wait(2.0);
    await G.say("He's not coming.", 2.6);
    await G.say("He's staying down there. With it.", 3.2);
    await G.wait(0.5);
    MH.Audio.bark([tw(15), 1, tw(9)], 1);
    await G.wait(1.5);
    MH.Audio.doorClose([tw(1), 2.5, tw(0)], true);
    await G.fade(1, 0.15, [0, 0, 0]);
    await G.wait(2.5);
    f.epilogue = true;
    f.escaping = false;
    P.eyeBoost = 0;
    G.lock(false);
    await G.goto('yard', 'morning', { fadeIn: 3, color: [1, 1, 1] });
  };

  Story.finale = async (G) => {
    G.lock(true);
    G.state = 'cutscene';
    await G.lookAt(tw(4), 0.4, tw(10) - 0.6, 2);
    await G.say("His collar. Hung on the cross, neat as anything.", 3.2);
    await G.say('Good boy.', 2.4);
    await G.say('Good boy, Biscuit.', 2.6);
    await G.fade(1, 3, [0, 0, 0]);
    G.clearSave();
    G.showEnding();
  };

  Story.ENDING = [
    "I didn't sell the house.",
    'I called the lawyer on Monday and told him the family would be keeping it.',
    'Every Sunday, before dark, I leave a plate at the cellar door and knock twice.',
    'Some nights I hear scratching down there.',
    'But most nights, if I listen very closely, I can hear a dog barking.',
    'As long as I can hear him, I know it is still asleep.',
  ];

  MH.Story = Story;
})(window.MH);
