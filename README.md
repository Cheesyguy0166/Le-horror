# MARROW HOUSE

*It has been three Sundays since anyone fed it.*

A first-person horror game with a PS1-era look, written from scratch in plain JavaScript and WebGL.
There are no engines, libraries or asset files. Every texture, model and sound is generated when the game loads.

![genre](https://img.shields.io/badge/genre-survival%20horror-8e1b17) ![deps](https://img.shields.io/badge/dependencies-none-444)

---

## The story

**November 14th, 1999. Sunday night.**

Your grandmother, Ruth Marrow, died three weeks ago and left you her farmhouse out on Pale Creek Road.
The lawyer's letter has one odd line in it, copied word for word from her will:

> *"Tell Robin to keep the Sunday supper. Before dark. Knock twice."*

You get there after dark, in the snow. A scruffy golden dog is waiting on the porch.
The lights are still on inside, and there are three plates of rotten food stacked by the cellar door.

Something has been living in the cellar of Marrow House since 1887. The family has fed it every Sunday for over a hundred years, and nobody has fed it since Ruth died.

The rest of the story is in the notes, the diary pages and the rooms of the house, so it isn't spoiled here.

### Who's who

| | |
|---|---|
| **You (Robin)** | Ruth's grandchild. You haven't been back to the house since you were nine. |
| **Biscuit** 🐕 *(the buddy)* | A scruffy golden dog with one crooked ear. He follows you everywhere, growls when *it* is near, leads you to where you need to go when you whistle, and if the Lodger ever gets its hands on you he'll pull you out of it. He can only do that so often, so don't count on him. Ruth's rules say *"Trust the dog."* |
| **The Lodger** *(the enemy)* | A tall, thin figure in an old Sunday suit. It checked into Marrow House in 1887 and asked to be paid with "supper, every Sunday." It sees light, hears running, opens doors, and can do voices. |

---

## How to play

**Option 1: just open it.** Double-click `index.html`. Everything is plain `<script>` tags, so it runs straight from disk in Chrome, Edge, Firefox or Safari.

**Option 2: serve it** (recommended; this also loads the retro web fonts):

```bash
npx serve .          # or: python3 -m http.server 8000
```

Then open the printed URL. Headphones and a dark room are strongly recommended.

### Controls

| Key | Action |
|---|---|
| **W A S D** / arrows | Move |
| **Mouse** | Look (click the game to capture the mouse) |
| **Shift** | Run (loud, and it drains stamina) |
| **C** / **Ctrl** | Crouch (quiet) |
| **E** / Space | Interact, read, open doors, pet the dog |
| **F** | Flashlight on/off |
| **Q** | Whistle for Biscuit. He'll lead you to your next goal |
| **Tab** / J | Journal: your current objective, and every page you've found |
| **Esc** / P | Pause (sensitivity, volume, scanlines, invert Y, restart from checkpoint) |

### Surviving the Lodger

- **It sees light.** With your flashlight on it can spot you from across a room. With it off, it has to get close. If you stand completely still in the dark, it can pass you by.
- **It hears running.** Footsteps, doors and whistling all make noise. Crouch-walking is almost silent.
- **Doors slow it down,** but it can open them.
- **Break line of sight.** If it loses you for a few seconds it gives up the chase and starts searching.
- **The oil lamp** lights everything around you, which makes you much easier to see.
- **Listen for it.** Clicking, raspy breathing, heavy footsteps, and voices that sound like people you know. When Biscuit growls, it's close.
- The game checkpoints whenever you change areas and at important story moments. Progress is saved in your browser, so **Continue** works after closing the tab.

A full playthrough takes about 20 to 40 minutes.

---

## The PS1 look

What the renderer does to get there (see `js/renderer.js`):

- **Low internal resolution.** The scene renders at roughly 240 lines and is upscaled by an exact integer factor with nearest-neighbour filtering.
- **Vertex snapping.** Vertices snap to the low-res pixel grid, which gives the classic PS1 wobble.
- **Affine texture mapping.** Textures warp across polygons the way they did on hardware without perspective correction.
- **Gouraud lighting.** Point lights are computed per vertex, limited to their room so they don't leak through walls.
- **15-bit colour with 4×4 ordered (Bayer) dithering,** film grain, a chromatic fringe, a vignette and optional CRT scanlines.
- **Distance fog** hides the draw distance, the way it did in *Silent Hill*.
- A **per-pixel flashlight** with banded falloff that lags slightly behind your view.
- **64×64 procedural textures** in a single atlas, sampled with nearest filtering and no mipmaps.
- **Boxy low-poly articulated models** with procedural animation for the dog and the creature.

All audio is synthesized live with the Web Audio API: HRTF-positioned footsteps, barks, growls, the creature's shrieks, clicks and "voice", a music box, a bell, a telephone, heartbeats and ambience.

---

## Project layout

```
index.html        page shell, HUD and menus
css/style.css     UI styling
js/core.js        math, matrices, noise
js/renderer.js    WebGL renderer + PS1 post-processing, mesh builder
js/textures.js    procedural texture atlas
js/audio.js       procedural sound engine
js/level.js       tile maps → geometry, doors, collision, line of sight, A* path finding
js/props.js       furniture and scenery builders
js/models.js      articulated models (the Lodger, Biscuit, dress forms) and item meshes
js/entities.js    interactables, dog AI, creature AI, apparitions
js/maps.js        the yard, the house, the attic and the cellar
js/story.js       notes, scripted events, objectives, ending
js/ui.js          HUD, subtitles, notes, journal
js/game.js        main loop, player, camera, checkpoints, input
```

No build step, no dependencies.
