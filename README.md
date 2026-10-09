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

- **Home background:** `assets/flatiron.jpg` fills the page; swap the file to change it. Glass styles (`.glass`, `.glass-bar`) live in `assets/site.css`.
- **Reports:** add PDFs to a `reports/` folder and point each report's button at its file.
- **Contact:** add your inbox after `mailto:` in the links on `contact.html`.
