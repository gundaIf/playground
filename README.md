# playground

A blank field for drawing sound. Click or type to play. Layer a loop. Take the wav with you.

Live at [playground.deeeen.xyz](https://playground.deeeen.xyz/).

## What it does

The whole page is one canvas. Click, drag, or press a letter key and a note sounds — pitch follows the vertical position, so the surface reads like a score you draw on rather than a keyboard.

Ten instruments, all synthesised in the browser with the Web Audio API — glass, kalimba, koto, rhodes, bells, analog, pad, acid, pulse, beats. No samples, no audio files.

Arm `record`, play a phrase, and it commits as a loop layer. Up to eight layers, each one mutable independently, with snap-to-grid and an adjustable BPM. `save` encodes the mixdown to a WAV and downloads it.

## Keys

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

## Run it

Static files, no build step. Open `index.html` from any local server (audio needs a real origin, not `file://`) — `python3 -m http.server` is enough.

More at [deeeen.xyz](https://deeeen.xyz/)
