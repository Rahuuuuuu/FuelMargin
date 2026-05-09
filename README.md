# Fuel / Axle Weight Calculator

A Progressive Web App (PWA) for commercial truck drivers to check legal axle weights, calculate maximum safe fuel loads, estimate driving range, and get tandem slider adjustment recommendations.

## Features

- Live axle weight checking against federal limits (steer, drives, trailer, gross)
- Max legal fuel warning with 50 lb safety buffer
- Three fueling modes: Manual, Fill to Full, Max Safe
- Fuel gauge with eighths for quick level entry
- Estimated driving range before and after fueling
- Tandem slider calculator with visual hole grid
- Steer axle minimum weight warning (steering safety)
- Truck profiles to save and recall settings
- Dark / Light / System appearance modes
- Fully offline capable via service worker
- Installs to iPhone home screen via Safari

## Setup

```bash
npm install
npm start        # development
npm run build    # production build
```

## Deployment

Connect this repo to Netlify. Build settings are pre-configured in `netlify.toml`.

After deploying, open the live URL in Safari on iPhone → Share → Add to Home Screen.

## Updating

After any code change:

```bash
git add .
git commit -m "Description of change"
git push
```

Netlify rebuilds automatically. If you update the service worker, increment `CACHE_VERSION` in `public/service-worker.js` before pushing.

## Icons

Add your app icons to `public/icons/`:
- `icon-192.png` — 192×192 px
- `icon-512.png` — 512×512 px

Use [favicon.io](https://favicon.io) or [realfavicongenerator.net](https://realfavicongenerator.net) to generate them from any square image.

## License

Private use only.
