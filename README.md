# playground

A few rooms. Pick one.

Live at [playground.deeeen.xyz](https://playground.deeeen.xyz/).

## Rooms

| Path | What it is |
| --- | --- |
| `/` | Lobby. Add a new room by adding a line here. |
| `/rain/` | Stand in the Kochi weather. Pointer parts the rain. |
| `/marks/` | Leave a fading ink trace. |
| `/field/` | Draw sound. Click or type. Layer a loop. Take the wav. |
| `/listen/` | Quiet Japanese-synth bed that follows the sky. |

The old full-page instrument now lives at `/field/`. Its engine is still `audio.js`, `play.js`, `ui.js` at the repo root.

## Adding a room later

1. Make a folder with an `index.html`.
2. Link it from the list in the root `index.html`.
3. Reuse `hub.css` and `sky.js` if it should follow theme and weather.

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
