# Island Wings — Pelican-9 over Pulau Kencana

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/HadiSH304/best-flight-game-20261126-0057-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/HadiSH304/best-flight-game-20261126-0057-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An original browser flight game, built for the make.fun bounty
[best-flight-game-20261126-0057](https://make.fun/c/best-flight-game-20261126-0057)
("Make the best flight game"). Fly the Pelican-9, a light prop plane, on
three sorties over the fictional island of Pulau Kencana: a ring slalom,
a crosswind runway landing, and a timed supply drop — with fuel and damage
that turn every sortie into decisions.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No build step, no network request.

- **Arrow keys** fly (Up/Down pitch, Left/Right bank); **W/S** work the
  throttle. **Space** drops a supply crate. **V** switches between chase
  and cockpit view. **P** pauses, **R** restarts, **M** mutes, **1/2/3**
  pick a mission. The mouse flies too: hold and drag to steer, click the
  mission buttons on the title screen.

## Missions

1. **Ring Run** — fly through all 8 rings in order around the island.
2. **Crosswind Landing** — land on runway 09 inside the touchdown zone,
   crabbing into a 14 kt crosswind from the north.
3. **Supply Drop** — drop 3 crates on the marked zones before the clock
   runs out. Crates keep your forward speed, so lead the zone.

Fuel burns with the throttle; run dry and the engine quits, leaving a
glide. Hard touchdowns and terrain strikes add damage; 100% damage loses
the aircraft. Below stall speed the wing stops lifting and the nose drops.

## Files

- `main.ts` — the entry program: hands `game/` and `screenshots/` in and
  writes `dossier.json` with the kit's `vendor/makefun-game.ts`.
- `game/index.html` + `game/src/` — the game itself, hand-rolled canvas 2D
  with a small 3D projection. One job per file: `flight-model.js` (throttle,
  banked turns, stall, fuel, damage), `terrain.js` (Pulau Kencana),
  `missions.js` (the three sorties and the score), `camera.js` (chase and
  cockpit views), `render.js` (sky, sea, island, runway, rings, aircraft),
  `instruments.js` (the lit six-pack), `hud.js` (altitude, speed, heading,
  fuel, damage), `input.js`, `audio.js` (synthesised engine and wind),
  `shots.js` (the deterministic screenshot scenes).
- `screenshots/` — four real renders of the game: the cover (chase view,
  ring ahead, runway below), a ring-run moment, a cockpit short final on
  runway 09, and a low-fuel supply drop over zone A.

Everything in the game — the idea, the art, the sounds, the names — is
original. No commercial game is copied.
