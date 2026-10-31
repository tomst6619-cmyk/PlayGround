# UFOS SCHAUEN

Ein atmosphärisches Nachtwache-Spiel für den Browser. Du sitzt an der Sternwarte Hochwald, hältst Ausschau nach echten Ufos und filmst sie mit der Kamera des Teleskops. Flugzeuge, Satelliten und Meteore gehören nicht ins Logbuch – wer sie filmt, verliert Signal und Filmvorrat.

Das Spiel läuft ohne Framework direkt im Browser, mit Canvas-2D-Grafik und einem prozedural erzeugten WebAudio-Soundtrack.

![Gameplay](screenshots/final-desktop.png)

## Spielen

1. **Zielen** – Maus bewegen oder den Finger auflegen und ziehen.
2. **Filmen** – Maustaste oder <kbd>Leertaste</kbd> gedrückt halten, bis der Belichtungsring voll ist.
3. **Prüfen** – Ruhig bleiben. Nur Objekte, die sich wie Ufos verhalten, lohnen eine Aufnahme.

Echte Kontakte geben Punkte und laden das Signal auf. Ein Fehlalarm kostet 12 Signal und 14 % Filmvorrat; ein entkommenes Ufo kostet 16 Signal. Fällt das Signal auf null, endet die Nachtwache.

### Steuerung

| Eingabe | Funktion |
| --- | --- |
| Maus / Finger | Zielen |
| Maustaste / Leertaste halten | Filmen |
| <kbd>Esc</kbd> oder <kbd>P</kbd> | Pause / weiter |
| <kbd>M</kbd> | Ton ein- oder ausschalten |
| Pfeiltasten / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> | Zielen mit der Tastatur |

## Regeln und Systeme

- **Signal:** Start bei 100. Aufnahmen geben +4, Fehlalarme −12, entkommene Ufos −16.
- **Filmvorrat:** Wird beim Filmen verbraucht und lädt sich in Pausen wieder auf.
- **Serie:** Aufeinanderfolgende Aufnahmen erhöhen den Multiplikator bis ×9.
- **Wellen:** Alle 30 Sekunden steigt die Aktivität; neue Ufo-Typen erscheinen.
- **Logbuch:** Hält fest, welche Typen wie oft bestätigt wurden.
- **Bestleistung:** Wird lokal im Browser gespeichert.

## Starten

Voraussetzung ist Node.js. Der mitgelieferte Server liefert die ES-Module mit korrektem MIME-Typ aus.

```bash
PORT=3002 bash start.sh
```

Danach <http://localhost:3002> öffnen. Der Server unterstützt Live-Reload während der Entwicklung.

## Tests

```bash
node --test test/logic.test.mjs
```

Die Tests prüfen die reinen Spielregeln in `js/logic.mjs`: Wellen, Spawn-Zeiten, Zielgenauigkeit, Belichtung, Akku, Punktzahl, Signal und Entity-Fabriken.

## Projektstruktur

```text
index.html          Spielmarkup, Overlays und HUD
styles.css          Gestaltung inklusive Mobil- und Safe-Area-Regeln
js/game.mjs         Zustandsmaschine, Steuerung, Spawning, Punkte, HUD
js/sky.mjs          Canvas-Renderer für Himmel, Ufos, Täuschungen und Retikel
js/logic.mjs        Reine Regeln und Entity-Fabriken (ohne DOM)
js/audio.mjs        Prozeduraler Ambient-Sound und Effekte
server.mjs          Statischer Server mit .mjs-MIME und Live-Reload
test/logic.test.mjs Tests für die Spielregeln
favicon.svg         Icon im Ufo-Design
```

## Hinweis

Der Ton startet erst nach der ersten Interaktion, wie es Browser für WebAudio verlangen. Das Spiel ist für Maus, Tastatur und Touch ausgelegt; auf schmalen Displays wechseln die Hinweise automatisch auf die Fingersteuerung.

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
