# 🧠 Brainrot Shorts Studio

Erstellt YouTube Shorts aus Reddit-Storys – komplett im Browser, gehostet auf GitHub Pages. Nicht als reines Vorlesen, sondern als eigenständiges Format:

1. **Nische statt Mischmasch** – feste Serien wie *Arbeit & Chef-Storys*, *Rache*, *AITA*, *Beziehung*, *Familie*, *Geständnisse*, *Gruselig* (oder eigene Subreddits). Breite Subreddits werden nach Thema gefiltert; jede Serie hat eigene Farben, Hashtags, Abschlussfrage und einen Folgen-Zähler („Boss Files #12“).
2. **Hook in den ersten 1–2 Sekunden** – das Video startet mit dem krassesten Satz der Story und großem Hook-Text im Bild, ohne Intro.
3. **Eigene Ebene** – eine wiedererkennbare Erzähler-Figur (Richterin Rita, Kumpel Kev, Dr. Psycho-Logik, Drama-Tante Doris, neutral) mit Namen, Avatar, eigener Stimme und eigener Meinung bzw. Analyse samt Urteils-Stempel.
4. **Story-Visuals statt Gameplay** – Chat-Nachbau für Dialoge, Emoji-Szenen mit Kernaussage, hochzählende Zahlen, die Reddit-Karte als Quelle. Alternativ *Split* (Visuals oben, Gameplay unten) oder *Klassisch* (Gameplay im Vollbild).
5. **25–45 Sekunden & Loop** – Ziel-Länge einstellbar; lange Storys werden in Teile mit Cliffhanger („Teil 2 folgt“) gesplittet. Der letzte Satz läuft grammatisch in den Hook zurück, und das letzte Bild gleicht dem ersten – so loopt das Video nahtlos.
6. **Engagement** – am Ende eine direkte Frage mit zwei Antwort-Buttons und Kommentar-Hinweis; die Frage steht auch ganz oben in der YouTube-Beschreibung.

Dazu: ElevenLabs-Voice-over mit wortgenauen Untertiteln, Autopilot (mehrere Storys inkl. aller Teile am Stück), MP4-Export (1080×1920) und fertige YouTube-Metadaten mit Quellenangabe.

### Skript-Autor: eingebaut oder mit Claude

- **Ohne KI (Standard):** wählt den dramatischsten Satz als Hook, baut Visuals aus Zitaten, Zahlen und Stichworten und splittet zu lange Storys. Die Story selbst wird nicht umgeschrieben, die Meinung ist eine Vorlage der Figur.
- **Mit Claude (optional, empfohlen):** Anthropic-API-Key unter „Claude als Skript-Autor“ eintragen. Claude verdichtet die Story auf die Ziel-Länge, schreibt ein echtes Urteil bzw. eine Analyse im Stil der Figur, ein passendes Storyboard, den Loop-Satz und einen YouTube-Titel – und übersetzt auf Wunsch ins Deutsche. Der Key bleibt im Browser und geht nur an `api.anthropic.com` (offizielles Anthropic-SDK, lokal unter `vendor/`).

Jedes Skript lässt sich vor dem Rendern Zeile für Zeile bearbeiten (Text, Visual-Typ, Chat-Absender, Emojis, Urteil, Frage, Loop).

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

Reddit wird zuerst direkt aus dem Browser über die öffentlichen `.json`-Endpunkte abgefragt. Reddit sperrt aber manche Netzwerke (VPN, Firmen-/Uni-Netz) und praktisch alle kostenlosen CORS-Proxys (corsproxy.io verlangt inzwischen außerdem einen API-Key). In dem Fall lädt das Tool automatisch über das Reddit-Archiv [Arctic Shift](https://arctic-shift.photon-reddit.com) – das erlaubt Browser-Zugriffe (CORS) und braucht keinen Proxy. Die Upvotes werden dort nachträglich aktualisiert, ganz frische Posts fehlen daher bei „Top“.

Unter „Quelle & Verbindung“ lässt sich die Quelle fest wählen (Automatisch / nur Reddit / nur Archiv) und optional ein eigener CORS-Proxy eintragen. Alternativ: Post-Link einfügen oder Text manuell ins Skript kopieren.

## Aufbau

| Datei | Zweck |
| --- | --- |
| `index.html`, `css/style.css` | Oberfläche |
| `js/app.js` | UI, Einstellungen, Autopilot |
| `js/niches.js` | Nischen/Serien und Erzähler-Figuren |
| `js/plan.js` | Skript-Modell (Hook, Story-Zeilen, Urteil, Frage, Loop) und Zeitachse |
| `js/scriptgen.js` | Eingebauter Skript-Autor ohne KI |
| `js/llm.js` | Skript-Autor mit Claude (structured output) |
| `js/planeditor.js` | Bearbeitbarer Skript-Editor |
| `js/visuals.js`, `js/compose.js` | Story-Visuals und Bildaufbau je Segment |
| `js/reddit.js` | Reddit-Abruf |
| `js/text.js` | Textaufbereitung, YouTube-Metadaten |
| `js/tts.js` | ElevenLabs (`/with-timestamps`) |
| `js/captions.js` | Wörter & Untertitel-Timing aus den Zeitstempeln |
| `js/draw.js` | Reddit-Karte, Untertitel, Neon-Runner, Video-Zuschnitt |
| `js/backgrounds.js` | Eingebaute animierte Hintergründe |
| `js/catalog.js` | Katalog freier Open-Source-Gameplay-Clips (Wikimedia Commons) |
| `js/render.js` | Audio-Mix + Video-Encoding (WebCodecs) |
| `js/db.js` | IndexedDB-Ablage für Gameplay & Musik |
| `vendor/mediabunny-1.59.1.min.mjs` | [Mediabunny](https://mediabunny.dev) (MPL-2.0) zum Dekodieren/Kodieren/Muxen |
| `vendor/anthropic-sdk-1.8.0.min.mjs` | Offizielles Anthropic-SDK (Apache-2.0), für den Browser gebündelt |

Hinweis: Die Stories gehören ihren Autor:innen. Die automatisch erzeugte Beschreibung nennt Subreddit, Autor und Link – lass das drin.
