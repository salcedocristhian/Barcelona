# Barcelona Gardens · Restoration App

Field app for the **Barcelona Gardens Condominium** concrete and stucco restoration
(MTD Painting & Construction, project MTD2025-016, 101 E McNab Rd, Pompano Beach, FL 33060).

It is a static web app: no server, no build step. It runs on iPhone, Android, tablets and
computers. On a phone, open it in the browser and use **Add to Home Screen** to install it like an app.

## What it does

- **Home** – large 3D model of the property, switch to elevations, open the last pay application record, start a **New Field Report**.
- **Model** – full viewer: 3D, floor plans and elevations (1 West, 2 South, 3 East, 4 North), NV5 repair marks, field repairs, life-safety devices, distance-to-exit check, black-and-white technical elevations.
- **Field reports** – tap the face of a building to place a repair, pick the SOW item (4A–4V), unit/location, quantity, status, notes and photos, then **Save to Draft**.
- **Records** – Pay App #3 (read-only technical record, no contract prices) and the editable **next pay app draft**. The draft starts from the quantities to date, adds field repairs, lets you edit any cell or add unit columns, and moves quantities over the contract quantity to change-order lines.
- **Exports** – Technical quantities Excel (without contract prices) (Summary + Bldg 100–400 sheets, same formulas and styles), PDF of the pay application, and a **Field Repair Report** PDF with the elevations, numbered repairs and photo thumbnails.
- **Photo reports** – Building 100 CompanyCam report (Nov 11, 2026, 49 photos) is included and placed on the elevations. Attach photos or a CompanyCam PDF for Building 200 and the others from **Records › Attach**.

## Publish with GitHub Pages

1. Create a repository on GitHub.
2. Upload **the contents of this folder** so `index.html` is at the top level (**Add file › Upload files**).
3. **Settings › Pages › Deploy from a branch**, branch `main`, folder `/ (root)`, save.
4. After a minute the app is at `https://<user-or-org>.github.io/<repository>/`.

Private repositories need a paid GitHub plan for Pages.

## Where your data is saved

There is no server. Drafts, finalized pay apps, field repairs and photos you add are saved **in the browser of the device** where you add them (IndexedDB). Use **Account › Export backup** to keep a copy or move it to another device, and **Restore from backup** there.

## Files

| Path | Contents |
| --- | --- |
| `index.html` | App shell and 3D/plan/elevation viewer |
| `js/app.js` | Field reports, records, drafts, exports, storage |
| `js/payapp.js` | Pay application engine (same calculations and workbook layout as the original) |
| `data/payapp-base.json` | Pay App #3 technical quantity data only; all prices/payment amounts omitted |
| `data/field-bldg100.json` | 33 field repairs read from the Bldg 100 CompanyCam photos |
| `data/nv5-repair-marks.json` | 105 NV5 repair marks with measured positions |
| `photos/bldg100/` | The 49 CompanyCam photos (and thumbnails) |
| `docs/` | Typical Elevations PDF (36×24″), sanitized Pay App #3 technical quantity workbook, MTD logo |
| `vendor/` | three.js r128, ExcelJS 4.4.0, jsPDF 2.5.1 + AutoTable 3.8.2 (MIT licenses included) |
| `tools/` | Python scripts that regenerate the elevations PDF |

## Data sources and limits

- Building plans measured from the NV5 AutoCAD drawings (3/16″ = 1′-0″); all four buildings identical.
- Repair marks from the NV5 repair location plans (permits BP25-00004816, -00004987, -00005001, -00004990).
- Bldg 100 field repairs placed from the CompanyCam photos, which have no captions: positions are approximate and editable.
- Heights estimated from photos (9′-4″ floor to floor, 18′-8″ eave, 22′-4″ roof).
- Reference tool for coordination; it does not replace the signed NV5 drawings or the engineer's approval of quantities.

## PUBLIC SITE FINANCIAL PRIVACY NOTICE

This is a public GitHub repository. The uploaded ZIP contained a confidential Pay App #3 workbook and monetary values duplicated in JSON and HTML. They have been withheld/redacted from this public deployment. Public financial exports are deliberately disabled, while field repair PDFs, technical quantities, photos, NV5 marks, models and editable field records remain available. To enable financial Pay App exports, use a secured private backend/account rather than publishing financial figures on GitHub Pages.

The previous main branch is preserved in `backup-before-barcelona-zip-2026-11-11`; existing public technical records remain untouched.
