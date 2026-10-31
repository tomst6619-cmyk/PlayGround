# SOUL EYES

A first-person browser horror game. You wake in a derelict hospital with five souls scattered through the maze. Collect all five, stay out of the demon's sight, and escape through the EXIT gate.

Everything is procedural — geometry, textures, audio, and the demon are generated at runtime with a vendored copy of Three.js. No external assets, fonts, or network requests.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/tomst6619-cmyk/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/tomst6619-cmyk/PlayGround)

- 🎮 [Open the project](https://omgithub.com/tomst6619-cmyk/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=tomst6619-cmyk%2FPlayGround).
- 💻 [Explore the source](https://github.com/tomst6619-cmyk/PlayGround).
- 🛠️ [Check build runs](https://github.com/tomst6619-cmyk/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/tomst6619-cmyk/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/tomst6619-cmyk).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## How to play

1. **Find the five souls.** They glow in the dark; the pips at the top of the screen track your progress.
2. **Stay out of its sight.** The demon follows sound and line of sight. Break away, round corners, and use the flashlight sparingly.
3. **Escape.** With all five souls collected, the EXIT gate unlocks. Reach it before the demon catches you.

Getting caught triggers a jump scare and a retry. There is no penalty for taking your time — apart from the thing hunting you.

### Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | `WASD` / arrow keys | Left joystick |
| Look | Mouse (click the scene to lock the pointer) | Drag anywhere on the scene |
| Sprint | `Shift` (uses stamina) | `SPRINT` button |
| Flashlight | `F` | `LIGHT` button |
| Mute | `M` | `SND` button |
| Pause | `Esc` / `P` | Pause bars, top-left |

The layout respects phone safe areas and disables browser gestures on the game surface, so it plays in portrait or landscape on Android and iOS.

## Run locally

The game is plain static HTML/JS. Any static file server works:

```bash
./start.sh                 # project helper (uses PORT if set)
# or
python3 -m http.server 3002
```

Then open <http://localhost:3002/>.

For the screenshot capture smoke test:

```bash
CAPTURE_URL=http://localhost:3002 CAPTURE_DIR=screenshots CAPTURE_STRICT=1 ./capture.sh
```

## Tech notes

- Three.js r161 is vendored in `vendor/`, so the game runs offline.
- On software renderers and mobile GPUs the game detects `llvmpipe`/WebDriver, lowers the pixel ratio, disables shadows, and drops expensive texture work automatically.
- `window.__SOUL_EYES__` exposes the game state, world, demon, and renderer for debugging and automated tests.
