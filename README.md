# Barcelona Gardens · Restoration Viewer

Interactive 3D model, floor plans and elevations of **Barcelona Gardens Condominium**
(101 E McNab Rd, Pompano Beach, FL 33060) showing the NV5 concrete and stucco repair
locations for the MTD Painting & Construction restoration project (MTD2025-016).

It is a single static web page. It runs in any modern browser on phones, tablets and
computers, with no server code, build step or account needed.

## What's in this repository

| Path | Contents |
| --- | --- |
| `index.html` | The viewer: 3D model, plans, elevations, black-and-white elevation mode, repair details and exit-distance check |
| `vendor/three/` | three.js r128 and its OrbitControls and BufferGeometryUtils helpers (MIT license), served locally so the 3D view does not depend on an outside CDN |
| `docs/Barcelona_Gardens_Typical_Elevations.pdf` | 36×24″ sheet set with the typical elevations of each building |
| `docs/mtd-logo.png` | Original MTD company logo used in the report / technical drawings |
| `assets/barcelona-icon-*.png` | Barcelona Gardens app logo in iPhone / web icon sizes |
| `assets/barcelona-logo-original.jpeg` | Supplied original Barcelona Gardens icon image |
| `manifest.webmanifest` | Installable web-app metadata for mobile browsers |
| `data/nv5-repair-marks.json` | The 105 NV5 repair marks with their measured plan positions |
| `tools/` | Python scripts that generate the PDF from the same data |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## Publish it with GitHub Pages

1. Create a new repository named **Barcelona** on GitHub (private only if GitHub Pages is supported by your plan; public makes the public viewer accessible). Do not pre-create a README if uploading an existing package.
2. Unzip this package and upload **the contents of the folder** (not the folder itself) to the repository, so `index.html` sits at the top level. On github.com you can drag the files into **Add file › Upload files**.
3. Go to **Settings › Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select the `main` branch and the `/ (root)` folder, and save.
4. After a minute or two the page is live at `https://<your-user-or-org>.github.io/<repository-name>/`.

Share that link; it opens on any device. On an iPhone, open the GitHub Pages address in **Safari** and use **Share → Add to Home Screen**. The supplied Barcelona building image appears as the home-screen icon. The app is a web app, not a native App Store app.

The top **Open Report PDF** link and the sidebar **Technical Report** section open the attached 10-sheet PDF, which is stored in `docs/`. These links work with the same relative paths on GitHub Pages. The existing interactive 3D, plan and elevation code remains unchanged.

## Open it without GitHub

Opening `index.html` directly from your computer also works in most browsers. If the 3D view stays blank, serve the folder locally instead:

```bash
cd barcelona-gardens-viewer
python3 -m http.server 8000
# then open http://localhost:8000
```

## Regenerate the PDF

Requires Python 3 with `reportlab` and the DejaVu Sans Condensed font (installed by default on most Linux systems; on macOS or Windows, edit the font paths at the top of `tools/elev_pdf.py`).

```bash
pip install reportlab
cd tools
python3 elev_pdf2.py
```

The PDF is written to `docs/Barcelona_Gardens_Typical_Elevations.pdf`.

## Data sources and limits

- **Building plans:** measured from the NV5 AutoCAD drawings (scale 3/16″ = 1′-0″). Length 201′-7″, depth 78′-4″, 25′-0″ units, 5′-0″ corridor. All four buildings are identical.
- **Repair locations:** NV5 Concrete/Stucco Repair Location Plans, permits BP25-00004816 (Bldg 100), BP25-00004987 (Bldg 200 and clubhouse), BP25-00005001 (Bldg 300) and BP25-00004990 (Bldg 400).
- **Heights:** estimated from site photos (floor-to-floor 9′-4″, eave 18′-8″, roof 22′-4″). No drawing gives heights, so the height of each mark is approximate.
- **Site layout, clubhouse, pool and parking:** aerial view calibrated to the measured building length.
- **Life-safety devices:** from the typical diagram in the MTD phasing plan, which is not to scale.

This is a reference tool for coordination. It does not replace the signed NV5 drawings.


## Field Records / Pay Application #3 (November 2026 enhancement)

The application includes an **interactive, mobile-friendly Field Records** bottom sheet connected to the existing NV5 repair marks in 3D, plan and elevation views. Select any mark and choose **Edit field record** to record an observed condition, SOW line item, actual field quantity (with units), field status, observer, date, notes and guided verification steps. Updates recolor corresponding 3D/plan markers immediately on the current device.

**Records > Pay App #3** contains a frozen **technical** extract of the provided Excel workbook, with measured quantities through **October 24, 2026**, for the period ending October 31, 2026. Four building tabs and 26 SOW codes are supported. Use the **Scope / PDF** tab to inspect contractual SOW descriptions, export/import an editable JSON field draft, download a safe Excel technical record or open a separate **revised field report** and save it as PDF through the browser's Print dialog.

### Data, approvals and privacy

- The original workbook contains **unit prices, contract values and payments**. These have **not** been committed to this public repository. The public dataset is `data/pay-app-3-quantities-public.json`; the sanitized technical spreadsheet is `docs/Barcelona_Pay_App_3_Technical_Quantities.xlsx`.
- **Pay App quantities are field-measured billing backup**, not automatically work accepted, engineer-approved or completed. Do **not** add quantity-over-contract (CO) overages to measured totals; those overages are already part of the source totals.
- NV5 repair marks, source unit quantities and new field records have **different provenance**. No measurements are automatically attributed to a particular NV5 mark merely because they share a building or unit number. Association requires field confirmation.
- The original 10-sheet `Barcelona_Gardens_Typical_Elevations.pdf` remains **unchanged**. The revised field report is a separate print-ready document generated from the field draft.
- This is a **static GitHub Pages application**. Field edits persist in **this browser's localStorage only** and update the interface immediately on that device. They are **not** server-synced across PMs/devices. Export JSON backups to preserve and transfer revisions. For shared real-time records, a secure authenticated backend and audit trail must be implemented.

