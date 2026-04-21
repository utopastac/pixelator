# Pixelator

A browser-based pixel art editor that runs entirely in the browser with all data stored in `localStorage`.

## Features

- **Drawing tools**: paint, eraser, fill, eyedropper, line, rectangle, circle, triangle, star, arrow, pen, marquee selection, move
- **Layers**: add, delete, duplicate, reorder, rename, toggle visibility, adjust opacity
- **Undo/redo**: 50-step history per drawing session
- **Zoom and pan**: scroll-wheel zoom, spacebar-drag pan, pinch-to-zoom on trackpad
- **Colour palettes**: multiple built-in palettes selectable per drawing, plus a global list of custom colours
- **Recent colours**: the last 5 applied colours are shown for quick reuse
- **Multiple drawings**: create, rename, duplicate, and delete drawings from the sidebar
- **Export**: SVG, PNG (with configurable scale factor), and Pixelator backup file

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a browser. Drawings are saved automatically to `localStorage`. Clearing site data will remove them.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run the TypeScript compiler without emitting output |
| `npm run test` | Run unit tests in watch mode (Vitest) |
| `npm run test:run` | Run unit tests once |
| `npm run e2e` | Run Playwright end-to-end tests against the production build |
| `npm run lint` | Lint the codebase with ESLint |
| `npm run format` | Format all files with Prettier |

## Stack

- TypeScript
- React 19
- Vite
- CSS Modules
- Vitest
- Playwright

## Deploy on GitHub Pages with `f-90.co.uk` subdomain

This repo already includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that builds and deploys `dist` to GitHub Pages when you push to `main`.

### 1) Pick your subdomain

Choose the hostname you want, for example `pixelator.f-90.co.uk`.

### 2) Add a `CNAME` file

Create `public/CNAME` with a single line:

```txt
pixelator.f-90.co.uk
```

Then commit and push.

### 3) Enable Pages in GitHub

In your GitHub repository:

- Go to **Settings > Pages**
- Set **Source** to **GitHub Actions**
- Wait for the `Deploy to GitHub Pages` workflow run to complete

### 4) Add DNS record at your domain host

For a subdomain (recommended), create a `CNAME` record:

- **Name/Host**: `pixelator` (or whatever subdomain label you chose)
- **Target/Value**: `<your-github-username>.github.io`
- **TTL**: default

### 5) Set the custom domain in Pages

Back in **Settings > Pages**:

- Enter `pixelator.f-90.co.uk` in **Custom domain**
- Enable **Enforce HTTPS** once DNS has propagated

### Notes

- DNS propagation can take anywhere from a few minutes to 24 hours.
- This app uses hash routes (`#/...`), so no extra SPA rewrite config is needed on GitHub Pages.
