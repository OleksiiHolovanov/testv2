# GoldTrail Social — v2 Journey adaptation

This package is the v2 adaptation of the static US social-casino landing page. The landing-page hierarchy from v1 is preserved, while the visual layer has been moved toward the requested “Luck Is a Journey” direction: dark cinematic fantasy, treasure-map mood, brass/gold accents, serif display typography, signpost-style navigation, golden CTAs and journey-based copy.

## What changed in v2

- Updated global design tokens in `assets/css/styles.css` to a dark black-blue / brass-gold theme.
- Reworked the hero into a cinematic treasure-map journey concept with the headline “Luck isn't found. It's followed.”
- Added journey navigation labels: How it works, Rewards, Providers, Help. Providers points to the providers block anchor (#providers).
- Added three hero benefit cards: Explore, Take chances, Earn rewards.
- Replaced old neon/social-casino image assets with v2 map/compass/lantern themed WEBP assets.
- Replaced the favicon with `favicon.ico` because all other images are WEBP.
- Updated config metadata to `v2-journey-social-casino`, so Google Sheet rows can identify this version.
- Kept the 3-step registration flow, validation, Google Sheet JSONP write logic, offer screen, checkout stub, legal pages and social-casino disclaimers.

## Included pages

```text
/
├── index.html
├── signup/index.html
├── login/index.html
├── account/index.html
├── checkout/index.html
├── terms/index.html
├── privacy/index.html
├── responsible-social-gameplay/index.html
├── assets/
│   ├── css/styles.css
│   ├── js/config.js
│   ├── js/app.js
│   └── img/*.webp + favicon.ico
├── IMAGE_PROMPTS_V2.md
└── google-apps-script/Code.gs
```

## How to open locally

Run a local static server from this folder:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

## Where to change content

Main settings are in:

```text
assets/js/config.js
```

Important fields:

```js
brand
version
source
supportEmail
googleScriptUrl
mainOffer
formOffer
packageName
packagePrice
packageCoins
```

## Where to change the v2 style

Global style tokens and the v2 adaptation overrides are in:

```text
assets/css/styles.css
```

Main token groups:

```css
--bg
--bg-soft
--bg-panel
--text
--text-muted
--gold
--gold-2
--border
--shadow
--font-body
--font-display
```

## Image prompts

All prompts for final AI-generated production assets are in:

```text
IMAGE_PROMPTS_V2.md
```

Current files are already inserted under the expected filenames. To replace them with AI-generated production images, export every image as WEBP except `favicon.ico`, keep the same filenames, and overwrite the files in `assets/img/`.

## Google Sheet integration

The form still uses the Apps Script endpoint from:

```text
assets/js/config.js
```

Use the script in:

```text
google-apps-script/Code.gs
```

Deployment settings:

```text
Deploy → New deployment → Web app
Execute as: Me
Who has access: Anyone
```

Registration rows use `event_type = registration`. Checkout/package rows use `event_type = purchase_intent`. The saved metadata now identifies the page as v2 through `version` and `source`.

## Compliance notes

The site keeps the required social-casino language: virtual Gold Coins / Sweeps Coins, 18+ only, no real-money gambling, no cash value, NO PURCHASE NECESSARY, and void where prohibited.

## Speed / adaptability note

The adaptation keeps the static architecture: no framework runtime, no external font requests, lazy loading below the fold, local WEBP assets, width/height image attributes, and reusable section classes. The v2 switch was done through config, CSS tokens/overrides, copy changes and asset replacement without changing the registration logic. Estimated adaptation time for a prepared v1 skeleton: 2-3 hours, excluding manual AI image generation and deployment testing.
## Image naming cleanup

Unused duplicate root-level script/style files and macOS service files were removed. Production image names now describe their role or the block where they are used, for example `hero-treasure-map-journey.webp`, `social-proof-mobile-player.webp`, `game-card-sky-atlas.webp`, and `cta-community-treasure-map.webp`.

## Registration service fix

The frontend is connected to the current Google Apps Script endpoint:
`https://script.google.com/macros/s/AKfycbxkymx562_L_u65qNr9YyYZI5hsr8odj5HdEfaXROk2sDhYs8kvDlznYHfCUP2h0Nr5Qw/exec`

`formPublicKey` must match `PUBLIC_FORM_KEY` in Apps Script. Current matching value:
`goldtrail-social-v1-public-2026-05`

If you change `PUBLIC_FORM_KEY` in Google Apps Script, update `assets/js/config.js` too.

## Registration transport update

The registration submit now uses a hidden iframe POST transport instead of a JSONP script request. This avoids browser/network errors where the request reaches Apps Script through a redirected `script.googleusercontent.com` response and the frontend cannot read it reliably.

Important: after copying `google-apps-script/Code.gs` into Apps Script, deploy a new Web App version:

```text
Deploy → Manage deployments → Edit → New version → Deploy
Execute as: Me
Who has access: Anyone
```

The Content Security Policy now allows the hidden Apps Script iframe and form submission through `frame-src` and `form-action`.


## Registration response fix

The frontend now uses JSONP GET requests for Apps Script responses. This avoids the hidden iframe timeout issue where data is saved in Google Sheets but the landing page cannot read the response. The Apps Script URL and public key live in `assets/js/config.js`.


## PageSpeed update

- The hero background is now a real responsive image element with `fetchpriority="high"` and preload, so Lighthouse can prioritize the LCP asset correctly.
- The mobile hero uses `hero-treasure-map-journey-mobile.webp`; desktop keeps the full hero image.
- Non-critical visual images were resized/compressed in WEBP. Favicon remains `.ico`.
- Image width/height attributes were corrected to reduce CLS.
- Mobile backdrop blur and heavy shadows were reduced to improve Speed Index and paint time.
