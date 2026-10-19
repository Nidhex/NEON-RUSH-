# NEON RUSH ⚡

> **High-Octane Cyberpunk 3D Endless Runner** built with Vanilla JavaScript, HTML5 Canvas API, and Web Audio API.

---

## 🎮 Overview

**Neon Rush** is a fast-paced endless runner set across a glowing highway cutting through an electric cyberpunk metropolis at night. Navigate three lanes, jump over high-voltage laser barricades, slide under overhead plasma beams, dodge towering cyber monoliths, and collect spinning cyber-tokens and power-ups to achieve the highest score.

---

## 🚀 Features & Upgrades

- **Calibrated Jump Physics & Velocity-Verlet Integration**:
  - Deterministic jump trajectory with zero drift across variable refresh rates ($60\text{Hz}$, $120\text{Hz}$, $144\text{Hz}$).
  - Jump duration calibrated to $0.80$ seconds with an apex height of $1.50$ meters.
  - Parabolic coin jump arcs synchronized with player ascent and descent.
  - Swept longitudinal collision detection preventing frame tunneling at high speeds ($24\text{ to }50\text{ m/s}$).
- **Genuine 3D Perspective on HTML5 Canvas**: Custom focal-length 3D projection engine with dynamic vanishing point, road rail curvature, and animated highway markings.
- **Procedural Cyberpunk Environment**:
  - Full-width parallax neon skyline with illuminated skyscrapers, retro synthwave sun, and ambient particle atmosphere.
  - Perspective synthwave cyber ground grid outside the roadway.
  - Roadside energy pylons and speed-line vignettes during high-velocity runs.
- **Three-Lane Movement & Stunt Mechanics**:
  - Smooth lane transitions with bank/roll tilts.
  - High-jump trajectory allowing the player to clear low hurdles and collect aerial coin arcs.
  - Low-profile sliding dash allowing the player to duck beneath overhead security beams.
  - Fast-fall slam dive: pressing slide while airborne immediately returns the player to the road.
- **Fair & Solvable Obstacle Waves**:
  - 3 distinct obstacle types: `LOW_BARRIER` (jumpable), `HIGH_BEAM` (slidable), and `CYBER_WALL` (must dodge).
  - Guaranteed solvability algorithm ensures no impossible impassable walls ever spawn.
- **Power-Ups & Collectibles**:
  - Hexagonal Cyber Coins (+50 pts).
  - 🛡️ **Shield**: Absorbs a lethal hazard impact.
  - 🧲 **Magnet**: Attracts nearby coins with magnetic suction physics.
  - ⚡ **2X Multiplier**: Doubles distance and coin score.
- **Procedural Web Audio Engine**:
  - Zero external MP3/WAV dependencies.
  - Procedural sound effects for jumps, slides, coin chimes, shield pickups, and explosive crashes.
  - 16-step procedural synthwave soundtrack with pulsing basslines, arpeggios, and electro drum beats.
  - Complete audio mute and volume controls.
- **Cross-Platform Responsive Controls**:
  - **Desktop**: Arrow keys (`←`, `→`, `↑`, `↓`), `WASD`, `Space`, `Esc`/`P` (Pause).
  - **Mobile**: Touch swipe detection (Swipe Left, Right, Up, Down) with prevent-default scroll protection.
  - **Virtual On-Screen Controls**: Universal pointer-driven touch d-pad and action buttons.
- **Technical SEO & Crawlable Content**:
  - Semantic HTML5 structure with accurate metadata, Open Graph, Twitter Cards, and Schema.org `VideoGame` JSON-LD.
  - Rich, crawlable guide content located below the arcade viewport (How to Play, Controls Reference, Pro Tips, FAQ).
  - Original SVG Favicon (`assets/favicon.svg`) and Social Preview card (`assets/og-preview.svg`).
- **Google AdSense Compliant Architecture**:
  - Dedicated, non-intrusive ad slot reserved in the crawlable content stream below the game screen.
  - Strictly separated from gameplay canvas and controls (zero overlays, zero accidental clicks).

---

## 📂 Project Structure

```
neon-rush/
├── index.html              # Main HTML5 entry point, semantic SEO guide, and AdSense slot
├── styles/
│   └── main.css            # Responsive layout, glassmorphism, safe area insets, guide styling
├── src/
│   ├── main.js             # Entry script, high-DPI canvas handling, fixed-timestep loop
│   ├── game.js             # Game state machine, 3D projection, skyline & ground rendering
│   ├── player.js           # Jump physics (midpoint integration), 3D reach calculation, avatar
│   ├── obstacles.js        # Obstacle manager, wave generation, and fair collision checks
│   ├── collectibles.js     # Coin patterns, jump arcs, power-ups, and magnet suction
│   ├── particles.js        # High-performance object-pooled particle system
│   ├── input.js            # Desktop keyboard and mobile touch gesture management
│   ├── storage.js          # LocalStorage manager with safe fallback and validation
│   ├── audio.js            # Web Audio API sound effects and procedural synthwave music
│   └── ui.js               # HUD overlays, pause/game-over screens, modals, and settings
├── assets/
│   ├── favicon.svg         # Original neon lightning cyber SVG favicon
│   ├── og-preview.svg      # Original 1200x630 social preview card
│   └── audio/              # Reserved directory for optional audio assets
├── tests/
│   └── game-tests.js       # Automated test suite (44 deterministic unit & integration tests)
└── README.md               # Game documentation and architecture guide
```

---

## 💻 How to Run Locally

### Option 1: Using Python (Built-in)
From the project root:
```bash
python -m http.server 8080
```
Then navigate to: `http://localhost:8080/neon-rush/index.html`

### Option 2: Using Node.js / npx
```bash
npx serve .
```

---

## 🧪 Automated Testing

### 1. Terminal (Node.js)
Run the 44-test deterministic physics and gameplay suite:
```bash
node neon-rush/tests/game-tests.js
```

### 2. In-Browser Diagnostics
Click the **"Diagnostics 🧪"** button on the title screen of the game, then click **"EXECUTE TEST SUITE ⚡"** to execute all 44 test cases directly in the browser environment.

---

## 🌐 Production Deployment & Google AdSense Readiness

### 1. Canonical URL & Domain Configuration
Before publishing to a live domain, update the canonical URL in `neon-rush/index.html`:
```html
<link rel="canonical" href="https://yourdomain.com/neon-rush/">
```
And update the Open Graph URL:
```html
<meta property="og:url" content="https://yourdomain.com/neon-rush/">
```

### 2. Google AdSense Integration Steps
When ready to apply for Google AdSense:
1. Ensure your website features a clear homepage, About page, Contact page, and Privacy Policy.
2. In `neon-rush/index.html`, locate the reserved ad container:
   ```html
   <aside class="ad-slot-container" aria-label="Advertisement placeholder">
   ```
3. Replace the `.ad-banner-placeholder` div with your verified Google AdSense ad unit code:
   ```html
   <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot="XXXXXXXXXX"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
   <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
   ```
4. Ensure advertisements remain strictly outside the `#game-container` canvas viewport to maintain compliance with Google AdSense gaming policies.
