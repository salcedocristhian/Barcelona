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
