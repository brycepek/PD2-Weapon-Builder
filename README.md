# PAYDAY 2 Weapon Builder

A desktop-ready PAYDAY 2 weapon builder focused on fast comparison, mod compatibility, skill effects, and importable/exportable builds.

Current to Update 245.

Planned to add visuals/photos of the weapons and potenitally modifications. Feel free to suggest additions. Make sure to share your builds!

Built with **React**, **TypeScript**, **Vite**, and **Tauri**.

## Features

### Gun Database

- Browse weapons in a dense database-style table.
- Weapons are grouped by category, such as pistols, akimbo weapons, shotguns, LMGs, SMGs, assault rifles, and sniper rifles.
- Collapse or expand weapon categories.
- Search by weapon name, category, or ID.
- Sort weapons by key stats.

### Build Mode

- Select a weapon and edit compatible attachment categories.
- Attachment categories include barrels, barrel extensions, magazines, sights, stocks, grips, gadgets, ammo, and boosts.
- Compatible mods are shown in sortable tables.
- Selected mods update the weapon's final stats immediately.
- Incompatible mods remain visible but are disabled with an explanation, for example:

  > Incompatible with [mod name] in [category].

### Stat Calculations

The builder uses raw PAYDAY 2 data and converts it into displayed stats.

Tracked stats include:

- Magazine
- Total ammo
- Damage
- Accuracy
- Stability
- Concealment
- Threat
- Reload time
- Runtime suppression

Supported calculation behavior includes:

- Accuracy and stability derived from raw spread/recoil indexes.
- Damage derived from mapped damage values and weapon stat modifiers.
- Threat derived from raw suppression index.
- Reload time derived from weapon timers and reload speed multipliers.
- Shell-by-shell reload timing for applicable weapons.

### Boosts

The builder includes a dedicated **Boost** section.

Available boost choices:

- No Boost
- Concealment Boost: `+1 concealment`
- Stability Boost: `+4 stability`
- Accuracy Boost: `+4 accuracy`

Only one boost can be active at a time.

### Skills

The **Skills** tab lets you apply PAYDAY 2 skill modifiers to the active build.

- Skills are grouped by weapon applicability.
- Skill sections can be collapsed.
- Applicable direct stat bonuses are added to build totals.
- Skill stat changes appear in blue next to mod deltas.
- Situational effects are listed under **Additional Stats** in Build Mode.

Examples of supported skill effects:

- Stable Shot
- Rifleman
- Marksman
- Aggressive Reload
- Shotgun CQB
- Shotgun Impact
- Fully Loaded
- Steady Grip
- Surefire
- The Professional
- Optical Illusions
- Equilibrium
- Gun Nut
- Akimbo
- One Handed Talent
- Desperado

### Import and Export

The top bar includes:

- **Export All**: exports selected weapon, mods, boosts, and skills.
- **Export Gun**: exports selected weapon, mods, and boosts only.
- **Import**: imports either export format.

Exports are copied to the clipboard and show a short confirmation message.

## Development

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

Build the web app:

```bash
npm run build
```

Run lint:

```bash
npm run lint
```

Preview the production build:

```bash
npm run preview
```

## Dataset

The app uses generated data from the `raw-data/` directory. To get the raw data, see [pd2_weapon_data_dumper.](https://github.com/brycepek/pd2_weapon_data_dumper)

Regenerate the app dataset with:

```bash
node scripts/build-dataset.mjs
```

Generated output:

```text
src/data/payday2-dataset.json
```

## Tauri

The project includes a Tauri shell in `src-tauri/`.

The Tauri config points to:

- Dev URL: `http://localhost:5173`
- Frontend build output: `dist`

## Project Structure

```text
raw-data/                 PAYDAY 2 source data dumps
scripts/build-dataset.mjs Dataset generation script
src/App.tsx               Main app logic and UI
src/App.css               Main interface styling
src/data/                 Generated app dataset
src-tauri/                Tauri desktop app shell
```

## Notes

This project is a fan-made PAYDAY 2 build tool. It is not affiliated with or endorsed by Starbreeze, Overkill, or PAYDAY 2.
