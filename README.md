# 🧠 Brainrot Shorts Studio

Erstellt automatisch YouTube Shorts im klassischen „Reddit-Story + Gameplay“-Stil – komplett im Browser, gehostet auf GitHub Pages:

1. **Story finden** – lädt Top-Posts aus r/confessions, r/AmItheAsshole, r/tifu, r/TrueOffMyChest … (eigene Subreddits hinzufügbar) und filtert nach Länge.
2. **Skript aufbereiten** – entfernt Links/Markdown/„Edit:“-Nachträge, schreibt Abkürzungen aus (AITA, BF, MIL, „(25F)“ …) und macht den Text optional YouTube-sicher (*freak*, *unalive*, …).
3. **Voice-over** mit ElevenLabs inkl. Zeitstempeln pro Zeichen → wortgenaue Untertitel.
4. **Video rendern** (1080×1920, 30/60 fps): Gameplay-Clip (Subway Surfers, Minecraft-Parkour, … – selbst hochgeladen) oder eingebauter Neon-Runner, Reddit-Karte während des Titels, große Pop-Untertitel mit Wort-Highlight, optionale Hintergrundmusik, Wasserzeichen, Fortschrittsbalken.
5. **Export** als MP4 + fertiger YouTube-Titel/Beschreibung mit Quellenangabe und Hashtags. Auf dem Handy direkt per „Teilen“ an die YouTube-App.

**Autopilot:** erzeugt N Videos am Stück – Stories laden, passende unbenutzte auswählen, vertonen, rendern. Bereits verwendete Stories werden gemerkt.

## Live schalten (GitHub Pages)

1. Im Repo unter **Settings → Pages → Build and deployment → Source** „**GitHub Actions**“ auswählen.
2. Auf `main` pushen (oder den Workflow „Deploy to GitHub Pages“ manuell starten).
3. Die Seite ist dann unter `https://<user>.github.io/<repo>/` erreichbar.

Es gibt keinen Build-Schritt – reines HTML/CSS/JS. Lokal testen: `python3 -m http.server` im Repo-Ordner und `http://localhost:8000` öffnen.

## Benutzung

- **ElevenLabs API-Key** unter [elevenlabs.io → Profile → API Keys](https://elevenlabs.io/app/settings/api-keys) erstellen (Rechte: *Text to Speech* und *Voices: Read*; für die Kontingent-Anzeige zusätzlich *User: Read*). Der Key bleibt in deinem Browser (localStorage) und wird nur an `api.elevenlabs.io` geschickt.
- **Gameplay:** Lade eigene Clips hoch (am besten H.264-MP4, gerne lang – es wird jedes Mal ein zufälliger Ausschnitt gewählt). Die Clips werden im Browser (IndexedDB) gespeichert, du musst sie also nur einmal hochladen. Bitte nur Material verwenden, das du nutzen darfst (z. B. „no copyright gameplay“-Videos).
- **Länge:** YouTube Shorts dürfen bis zu 3 Minuten lang sein. Der Längenfilter (Standard 30–90 s) schätzt die Sprechdauer vorab.
- **Browser:** Aktuelles Chrome oder Edge (Desktop) empfohlen – dort wird H.264/AAC kodiert. Andere Browser mit WebCodecs funktionieren ebenfalls (ggf. VP9/Opus im MP4, das YouTube ebenfalls akzeptiert). Das Rendern läuft schneller als Echtzeit.

### Reddit lädt nicht?

Reddit wird direkt aus dem Browser über die öffentlichen `.json`-Endpunkte abgefragt. Manche Netzwerke (VPN, Firmen-Netz) werden von Reddit blockiert. Dann:
- unter „Reddit blockiert? CORS-Proxy“ einen Proxy eintragen (z. B. `https://corsproxy.io/?url={url}`), oder
- den Post-Link einfügen bzw. den Text einfach manuell ins Skript kopieren.

## Aufbau

| Datei | Zweck |
| --- | --- |
| `index.html`, `css/style.css` | Oberfläche |
| `js/app.js` | UI, Einstellungen, Autopilot |
| `js/reddit.js` | Reddit-Abruf |
| `js/text.js` | Textaufbereitung, YouTube-Metadaten |
| `js/tts.js` | ElevenLabs (`/with-timestamps`) |
| `js/captions.js` | Wörter & Untertitel-Timing aus den Zeitstempeln |
| `js/draw.js` | Reddit-Karte, Untertitel, Neon-Runner-Hintergrund |
| `js/render.js` | Audio-Mix + Video-Encoding (WebCodecs) |
| `js/db.js` | IndexedDB-Ablage für Gameplay & Musik |
| `vendor/mediabunny-1.59.1.min.mjs` | [Mediabunny](https://mediabunny.dev) (MPL-2.0) zum Dekodieren/Kodieren/Muxen |

Hinweis: Die Stories gehören ihren Autor:innen. Die automatisch erzeugte Beschreibung nennt Subreddit, Autor und Link – lass das drin.
