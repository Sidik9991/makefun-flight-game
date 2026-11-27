[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Sidik9991/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Sidik9991/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# MERIDIAN RUN — a golden-hour airmail flight game

**Bounty:** [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) on make.fun

You are the evening pilot of the Meridian Air Post. In a cream-and-red Kestrel K-6
seaplane you fly six airmail sorties over a sunset archipelago — a harbour city,
a river canyon, a snow-capped massif, a lighthouse isle — threading golden rings,
watching fuel and hull, and landing the mail back on the home strip.

## Play it

Serve `game/` from any static file server and open `game/index.html` in desktop
Chrome. No build step, no network: three.js is vendored under `game/vendor/`,
everything else is this repository's own code.

- **W / S** — throttle up / down · **↑ / ↓** — climb / descend · **← / →** — bank and turn
- **A / D** — rudder · **mouse drag** — steer · **P / Esc** — pause · **M** — mute

## Systems

- **Flight model** (`game/src/aircraft.js`) — throttle discipline with energy
  trading between speed and height, coordinated banked turns, stall sink,
  wind drift, ground effect-free honest landings: runway arrivals are rated
  GREASER → TEETH-RATTLING, water ditching and rough field landings bend the
  hull instead of ending the day, and ridge scrapes accumulate damage.
- **The world** (`game/src/terrain.js`) — one analytic height field shared by
  the terrain mesh and the physics: Meridian Isle with its runway plain and
  Port Meridian's lit harbour blocks, the Thread river canyon, the Anvil
  massif, Lantern Isle and its lighthouse, a 700-tree conifer forest, gradient
  sunset sky, drifting clouds and a squashed-tube river.
- **Six sorties** (`game/src/missions.js`) — 35 golden rings in all: a first
  circuit, a harbour chain, threading the canyon, the summit post climb, a
  half-tank storm run to the lighthouse, and the full dusk circuit home.
  Rings are scored by true plane-crossing geometry, not proximity.
- **The panel** (`game/src/hud.js`) — a lit instrument cluster drawn every
  frame: artificial horizon, airspeed and altimeter dials, compass ribbon,
  digital ALT / SPD / HDG / V-S readouts, fuel / hull / throttle bars, a
  next-objective pointer, stall warning, banners and toasts.
- **Sound** (`game/src/audio.js`) — fully synthesized WebAudio: a radial
  engine that follows the throttle, wind that rises with airspeed, ring
  chimes, a landing arpeggio and a crash thud. No audio files.
- **Flow** (`game/src/main.js`) — mission select with progression, pause,
  sortie debriefs with mail score (rings + fuel and hull bonuses), ground
  crew refuel-and-repair on the strip, and a chase camera that never fights
  the pilot.

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with make.fun's vendored
dossier library (`vendor/makefun-game.ts`, the kit's copy, unchanged):

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The screenshots in `screenshots/` are real renders of this game's own code,
taken by its maker in a headless browser from staged scenes
(`game/src/main.js` answers `?shot=cover|canyon|menu|coast|summit|stakes|progress|result|landing`).
Every frame is in flight, panel lit, the sortie under way:

- `01-cover.jpg` — the hero shot: the Kestrel big in frame inside the
  third Harbour Chain ring over Port Meridian's towers, the game's title
  treatment over the sky naming its systems (6 sorties, 35 golden rings,
  fuel & hull stakes, rated landings), the panel live at 120 kt.
- `02-canyon-climb.jpg` — climbing through the Thread canyon: third ring
  filling the frame, walls on both shoulders, V/S +1.2 m/s on the panel.
- `03-storm-stakes.jpg` — the Storm Ledger with the stakes showing: the
  fuel bar down to a red stub, the fifth ring ahead, Lantern Isle's
  lighthouse beyond it.
- `04-final-approach.jpg` — the rated landing itself: all five rings
  flown, flaring slow over the home strip's threshold piano keys at
  30 m and 52 kt, throttle at a quarter on the panel.

MIT licensed — see `LICENSE`.
