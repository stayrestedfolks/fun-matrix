# The Fun Matrix

A free web tool by **Stay Rested** ([youtube.com/@StayRestedFolks](https://www.youtube.com/@StayRestedFolks)) that helps
WoW Forever players pick a character **fantasy first**:
1. **Faction**, with a coin flip as a gut check.
2. **Race:** Meh ↔ Cool, Boring ↔ Interesting.
3. **Class and spec:** Meh ↔ That's me, Boring ↔ Exciting.
4. **Professions:** Frustrating ↔ Worthwhile, Tedious ↔ Satisfying.

Each option you rate lands as a dot on a 2×2 matrix. The top score is suggested, and you have the last word. The
result is a character card with tailored safeguards, a share link and a PNG.

- **No accounts, no cookies, no backend.** Your ratings live only in the page link, after the `#`.
- **One anonymous, cookie-free page counter** (GoatCounter), off until a code is set in `index.html`.
- **Fan-made.** Not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft is a trademark of Blizzard
  Entertainment, Inc.

## Run it locally
```
npm start
```
Then open http://localhost:8191/. Node 20 or newer is needed; the server uses Node's built-ins only.

**Recording mode:** add `?rec` to the address, e.g. http://localhost:8191/?rec.
- It keeps the bottom-right quarter clear (right of 74% of the width, below 63% of the height) for the host's camera
  box. Nothing important ever sits there.
- It's built for a full-screen browser (F11) at 1920×1080 CSS pixels: Windows display scaling 100%, or browser zoom
  80% at 125% scaling.
- Share links never include `?rec`.

## Where things are
| Path | What |
|---|---|
| `index.html`, `css/`, `fonts/` | The page and the inn look |
| `js/app.js` | Screens, dialogs and events |
| `js/logic.js` | The rules: rounds, scores and ties, profession filters, safeguards (tested) |
| `js/state.js` | The share-link format (tested) |
| `js/matrix.js` | The 2×2 matrix (SVG); its geometry is shared with the PNG |
| `js/export.js` | The 1600×900 PNG, drawn in the browser |
| `data/forever.json` | **Every fact**, with its source and date |
| `tools/` | Local server, data checker, icon checker, data formatter |
| `tests/` | Unit tests and the browser walk-through |
| `PUBLISHING.md` | How to publish it, and how to update the facts |

## The facts
All facts live in `data/forever.json`, with an `asOf` date that the page shows. Each fact has a tag:
- **Dev notes:** confirmed in an official Blizzard post.
- **Classic:** true in Classic, and nothing official says Forever changed it.
- **Community:** guides, tier lists, census and forums. Many are based on the beta, which stopped at level 30.
- **Our read:** Stay Rested's own judgement where no guide rates it yet.

Each fact also has a `src` key pointing at `sources`, where the link and date live. Facts are written in our own
words; no Reddit usernames are ever stored.

**After a patch:**
1. Edit the data (a Claude session can do it).
2. Set `asOf` to the new date.
3. Run `node tools/format-data.mjs`, then the checks below.

**IDs never change**, because old share links use them.

## Checks
```
npm test
```
```
npm run check:data
```
```
npm run check:icons
```
```
npm run e2e
```
- `npm test`: unit tests (links, scores and ties, filters, safeguards).
- `npm run check:data`: ids, references, tags, sources, fact length and tone.
- `npm run check:icons`: every icon loads (needs the internet).
- `npm run e2e`: the whole tool in your Edge or Chrome, desktop and phone. Run `npm install` once first.

## Credits
- **Fonts:** [Cinzel](https://fonts.google.com/specimen/Cinzel) by Natanael Gama, and
  [Alegreya Sans](https://fonts.google.com/specimen/Alegreya+Sans) by Huerta Tipográfica. Both are under the SIL
  Open Font License; see `fonts/OFL-*.txt`.
- **Icons:** loaded at runtime from Blizzard's public icon service (`render.worldofwarcraft.com`). None are stored
  in this repo.
- **"Go deeper" tools by other fans:**
  - WoW Forever Rotation (wow-forever-rotation.vercel.app);
  - WoW Forever Character Forge (s3bt3r.github.io);
  - the Classic WoW Forever class quiz (classicwowforever.com);
  - Wowhead's Forever Talent Calculator and Dressing Room.
- **Facts:** from Blizzard's WoW Forever news and development notes, plus the guides, tier lists and census listed
  in the page's Sources dialog.

## Licence
The code is MIT (see `LICENSE`). Game names and icons belong to Blizzard Entertainment.
