# playground

A few rooms. Pick one.

Live at [playground.deeeen.xyz](https://playground.deeeen.xyz/).

## Rooms

| Path | What it is |
| --- | --- |
| `/` | Lobby. Rooms are glyphs in a constellation that leans away from your cursor. Sound toggle plays the sky score. |
| `/field/` | Draw sound. Click or type. Layer a loop. Take the wav. |
| `/strings/` | Nine wave-equation strings. Drag across them, or play `a s d f g h j k l`. Tuned to the Bangalore sky. |
| `/sand/` | Falling sand, water, stone. Grey sky over Bangalore means it rains in here too. Save a PNG. |
| `/flow/` | Hold to release ink into an invisible wind. Space re-rolls the wind. Save the print. |
| `/type/` | Write across the top, watch the words fall into a heap, sweep your hand through it. Works with any script. |
| `/dusk/` | Fireflies that drift together and slowly blink in sync. Thunder resets them. |

`/rain/`, `/marks/`, `/listen/` are gone and redirect to the lobby. The sky score from `/listen/` now lives in the lobby (`score.js`).

The old full-page instrument lives at `/field/`. Its engine is `audio.js`, `play.js`, `ui.js` at the repo root.

## Adding a room

1. `mkdir yourroom`, copy any of the new rooms' `index.html` (it loads `sky.js`, `room.js`, `yourroom.js`).
2. In `yourroom.js`, call `Room.mount({ name, hint, actions })`. You get the header, a full-bleed canvas, the bottom bar and theme toggle for free.
3. Use `Room.loop`, `Room.pointer`, `Room.inkRGB()` / `Room.bgRGB()`, `Sky.season()` / `Sky.storm()` so it follows theme and weather.
4. Add an `<a class="node" style="--x:..;--y:..">` to `index.html` (x/y are percentages) with a small SVG glyph.

## Field keys

| Key | Action |
| --- | --- |
| Letters | Play notes |
| `1`–`0` | Switch instrument |
| `Space` | Play / stop |
| `Enter` | Record |
| `Backspace` | Undo layer |
| `'` | Toggle snap |
| `-` / `=` | BPM down / up |
| `\` | Light / dark |

More at [deeeen.xyz](https://deeeen.xyz/)
