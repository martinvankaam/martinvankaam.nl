# martinvankaam.nl

Statische site, gehost op GitHub Pages vanaf de `main`-branch. Geen framework en geen afhankelijkheden: alleen Node om de pagina's te bouwen.

## Inhoud aanpassen

Alle tekst staat in `content/`:

| Bestand | Wat erin staat |
| --- | --- |
| `languages.json` | Talen, URL-paden en locales. Nu `nl` (`/`) en `en` (`/en/`). |
| `ui.json` | Menu, knoppen, categorienamen, titels en beschrijvingen voor zoekmachines en social previews. |
| `home.json` | De teksten van de pagina (introductie, Marbas, gebouwen, acquisitieprofiel, contact). |
| `timeline.json` | De tijdlijn: één lijst met gebeurtenissen, per taal een titel, toelichting en optioneel extra context. |

Een gebeurtenis in `timeline.json`:

```json
{
  "id": "graz-kotor",
  "date": "2022-09",
  "precision": "month",
  "categories": ["travel", "motors"],
  "image": "trip-vallei",
  "nl": { "title": "...", "summary": "...", "more": "..." },
  "en": { "title": "...", "summary": "...", "more": "..." }
}
```

- `precision` is `year`, `month`, `day` of `range` (dan ook `dateEnd`). Verzin geen datum die je niet weet: kies een grovere precisie.
- `categories`: `career`, `education`, `travel`, `sport`, `motors`, `life`. Een categorie zonder gebeurtenissen verschijnt niet in het filter.
- `image` is de bestandsnaam zonder `.jpg` in `assets/`. Maak er ook een `-sm.jpg` van (800 px breed) voor kleine schermen.
- `status: "planned"` toont het label "Gepland".

## Bouwen

```bash
node build.mjs
```

Dit schrijft `index.html`, `en/index.html` en `sitemap.xml`. Deze gegenereerde bestanden horen in de repository, want GitHub Pages bouwt niets zelf. Pas dus niet de HTML aan, maar de bestanden in `content/` en de templates in `build.mjs`.

Voorbeeld lokaal bekijken:

```bash
python3 -m http.server 8765
```

en open <http://localhost:8765/>.

## Een taal toevoegen

1. Voeg een regel toe aan `content/languages.json` (bijvoorbeeld `{ "code": "de", "path": "/de/", "name": "Deutsch", "short": "DE", "locale": "de_DE" }`).
2. Kopieer het blok van `nl` in `content/ui.json` en `content/home.json` naar de nieuwe taalcode en vertaal het.
3. Voeg bij elke gebeurtenis in `content/timeline.json` een blok met de taalcode toe.
4. Draai `node build.mjs`. De taalwisselaar, `hreflang`-links, sitemap en metadata komen vanzelf mee.

## Lettertype en afbeeldingen

- Lettertype: DM Sans (400 tot 700), zelf gehost in `assets/fonts/`. Er worden geen externe diensten geladen.
- Foto's staan als JPEG in `assets/`. De sociale preview is `assets/og.jpg` (1200 x 630).
