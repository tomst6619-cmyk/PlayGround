# DER LETZTE SCHULTAG

Ein kurzes, komplett im Browser gezeichnetes Comedy-Spiel in vier Akten.

Mathe, 5. Stunde, noch eine Minute bis zu den Ferien. Du starrst Herrn Müller an.
Herr Müller starrt zurück. Herr Müller kommt näher. Herr Müller wirft dich aus dem
Fenster. Danach trinkt er den Tod-Trank. Dann sind Ferien.

## Akte

1. **Der Blick** – Halte den Blickkontakt, bis Herr Müller durchdreht.
2. **Der Flug** – Lenke im Fallen und lande weich im Busch, Planschbecken oder Laubhaufen.
3. **Der Trank** – Wähle die richtige Flasche. Der Tod-Trank hat einen Totenkopf. Meistens.
4. **Ferien** – Alle rennen nach Hause. Du auch. Das Tor wartet.

## Steuerung

| Aktion | Tastatur | Touch |
| --- | --- | --- |
| Starren / Rennen | `Leertaste` halten | GUCKEN bzw. RENNEN halten |
| Fliegen lenken | `←` `→` oder `A` `D` | linke/rechte Bildschirmhälfte halten |
| Trank wählen | Flasche anklicken | Flasche antippen oder Knopf unten |
| Ton an/aus | `M` | Lautsprecher-Symbol |

Das Spiel läuft auf Desktop und mobil. Im Hochformat bleibt die Bühne im 16:9-Format;
Querformat zeigt mehr Schule. Alle Grafiken werden mit Canvas gezeichnet, alle Sounds
mit WebAudio erzeugt – es gibt keine externen Assets oder Fonts.

## Starten

```bash
./start.sh
```

Danach `http://localhost:3000` öffnen. Ein simples `index.html` im Browser reicht
ebenfalls, solange die Dateien unter `js/` mitgeladen werden.

## Projektstruktur

- `index.html` – Bühne, HUD, Titel- und Endbildschirm
- `styles.css` – Layout, responsive Regeln, Touch-Bedienung
- `js/core.js` – Konstanten, Helfer, Audio, Partikel, HUD
- `js/art-characters.js` – Kinder, Lehrer, Geist, Sprechblasen
- `js/art-props.js` – Tafel, Uhr, Fenster, Flaschen, Schule, Tor, Kulisse
- `js/game-scenes.js` – die vier Akte, Übergänge und Auswertung
- `js/game-render1.js` / `js/game-render2.js` – Zeichnen und Hauptschleife
- `js/main.js` – Eingaben, Spielschleife, Buttons

Zum Testen gibt es `window.SCHULTAG` mit `start()`, `act(1…5)`, `choose('tod')`,
`tap()` und `state`.

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
