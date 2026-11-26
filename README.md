# Nusantara Sky Courier ✈️

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zen1357/nusantara-sky-courier/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zen1357/nusantara-sky-courier/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D island-hopper seaplane courier game over a tropical Indonesian archipelago — volcanic islands, turquoise lagoons, beaches, island airstrips, drifting clouds and a low warm sun. You fly a little propeller seaplane from a chase camera, working courier jobs between the islands.

An entry for the [best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057) on make.fun.

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests at runtime — everything loads from `game/` (three.js is vendored under `game/vendor/`).

## Controls

| Key | Action |
| --- | --- |
| **W / S** | Throttle up / down |
| **↑ / ↓** | Pitch nose up / down |
| **← / →** | Bank left / right (banking turns the plane) |
| **Q / E** | Rudder (yaw) |
| **Space** | Brake on the ground |
| **Mouse drag** | Look around (camera orbit) |
| **Mouse wheel** | Zoom the chase camera |
| **P** | Pause |
| **M** | Mute |
| **Enter** | Start from the title screen |

Take off: hold **W** to spool the throttle, pull **↑** once you are rolling past stall speed, and climb away. Land gently — low vertical speed, low speed, on a runway — to refuel and repair.

## Missions

Pick one on the title screen:

1. **Ring Run** — fly the golden ring course (8 rings) over the islands. Threading a ring dead-centre pays a bonus.
2. **Island Deliveries** — carry cargo to all three island airstrips (Api Strip → Karang Field → Merdeka Field). Land, unload, take off again. Watch your fuel.
3. **Timed Courier** — 180 seconds on the clock. Rings appear around the archipelago; fly as many as you can before time runs out.

## Fuel, damage, decisions

- Fuel drains with throttle and refills **only** by landing at an airstrip — a long sortie is a fuel decision.
- Hard landings, terrain strikes and ditching in the sea damage the airframe; airstrips repair it while you are parked.
- Below stall speed the wings stop flying and she sinks. Empty tanks mean a glider — pick a strip and commit.

## HUD

Altitude, speed and heading in large numerals, a compass strip, an artificial horizon, throttle bar, fuel and airframe gauges, score, timer and the current objective — all big enough to read at a glance.

## Sound

All sound is synthesized live with WebAudio — engine hum tied to throttle, wind that rises with speed, a ring chime, a landing thud and warning beeps. No audio files.

## Source layout

```
game/
  index.html            entry point + import map
  vendor/three.module.min.js   vendored three.js r160
  src/
    main.js       boot + game loop + chase camera + screens
    config.js     tuning constants, islands, airstrips, ring course
    terrain.js    archipelago, sea, volcano, airstrips, rings
    sky.js        sky dome, sun, clouds, lighting
    aircraft.js   seaplane model + flight model (lift, drag, stall, damage)
    missions.js   ring course, deliveries, scoring, win/fail
    hud.js        instruments, compass, horizon, screens
    input.js      keyboard + mouse
    audio.js      synthesized WebAudio sounds
    shots.js      staged screenshot scenes (autopilot flies the real sim)
```

Screenshots under `screenshots/` are real renders of this game, staged by an autopilot that flies the actual flight model (`?shot=cover|rings|landing|title`).

## License

MIT — see [LICENSE](LICENSE).
