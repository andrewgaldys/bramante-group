# Bramante Group

Website for **Bramante Group, LLC**: commercial real estate data and research.

| Page | File |
| --- | --- |
| Home (single screen) | `index.html` |
| About | `about.html` |
| Research | `research.html` |
| Contact | `contact.html` |

- Tailwind CSS via CDN and Google Fonts (Cormorant Garamond + Inter); shared styles in `assets/site.css`
- Hosted on GitHub Pages from the `main` branch (no build step)

## Updating content

- **Home page:** animated data surface drawn by `assets/data-field.js`; the About / Research / Contact links are pinned to points on it (move them via each link's `data-node="x,y"` screen fractions, `data-node-sm` for phones).
- **Reports:** add PDFs to a `reports/` folder and point each report's button at its file.
- **Contact:** add your inbox after `mailto:` in the links on `contact.html`.
