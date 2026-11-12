# Barcelona Gardens · Restoration App

Field app for the **Barcelona Gardens Condominium** concrete and stucco restoration
(MTD Painting & Construction, project MTD2025-016, 101 E McNab Rd, Pompano Beach, FL 33060).
Static web app: no server, no build step. Works on iPhone, Android, tablets and computers;
on a phone use **Add to Home Screen** to install it like an app.

## Tabs

- **Model** – 3D, plan and elevations in one place, with a single bottom panel that has three heights:
  closed (building, NV5 marks, field repairs, draft amount, **New repair**), half (the selected repair),
  open (layers, legend, near-exit list, data sources). Walk inside any corridor with the door button.
- **Repairs** – every NV5 and field repair, filtered by building and status, with photos and stage.
  **+** imports a CompanyCam report or photos for a building.
- **Pay Apps** – Pay App #3 (read-only) and the editable next draft; Excel in the original workbook format and PDF.
- **Reports** – engineering report supporting the pay application, per building or for all buildings, in large print by default: cover with quantities by repair type, typical elevations (no marks), repair locations highlighted on the walls, one repair table (ID, unit, location, type, quantity), balcony aerial views with the repair areas, and the balcony photo log.
  enlarged plans with each patch measured, photo log by repair with stage and date, and the elevations. Also the
  Typical Elevations PDF and the original Pay App #3 workbook.
- **Settings** (gear icon) – backup, restore and reset of the data saved on the device.

## Model

- Building plans measured from the NV5 AutoCAD drawings (3/16″ = 1′-0″); all four buildings identical.
- Site checked against the satellite views with the 50 ft scale bar; angled stalls along the drives.
- Clubhouse with five-arch arcades at both ends and hip tile roof; oval pool with coping, fence and lounge chairs;
  courtyard with two shuffleboard courts, flagpole, lamps and grills (sizes approximate).
- Lanais and balconies as built: ground-floor screen enclosures with kick panels and a screen door with transom next to the stucco pier between each pair; 2nd-floor enclosures with pickets below the handrail and screens up to the header; projecting slab band between floors.
- Corridor interiors (carpet, paneled unit doors, sconces, life-safety devices) for walking inside.
- Heights estimated from photos (9′-4″ floor to floor, 18′-8″ eave, 22′-4″ roof).

## Field data included

- **As-built repairs Bldg 100** – quantities by unit (balcony floors, column & beam, #5 rebar, dowels, stucco) with their locations on the walls.

- **ELEVATIONS BLDG 100** – CompanyCam, Nov 11, 2026, 49 photos; 33 wall and slab-edge repairs placed on the faces (approximate).
- **BALCONIES** – CompanyCam, Oct 20–21, 2026, 35 photos; balcony floors BF-119, 120, 121, 123, 124 and 129 with every patch measured (±6″).

## Publish with GitHub Pages

1. Upload **the contents of this folder** to a repository (`index.html` at the top level).
2. **Settings › Pages › Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The app is at `https://<user-or-org>.github.io/<repository>/` after a minute.

## Where your data is saved

There is no server. Drafts, finalized pay apps, repairs and photos you add are saved in the browser of the
device (IndexedDB). Use **Settings › Export backup** to copy them to another device and **Restore** there.

## Limits

Reference tool for coordination; it does not replace the signed NV5 drawings or the engineer's approval of quantities.
