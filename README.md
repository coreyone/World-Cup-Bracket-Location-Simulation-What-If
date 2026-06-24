# World Cup 2026 Bracket Simulator

A purely static, client-side React application for simulating the 2026 World Cup.

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Run Development Server**
   ```bash
   bun dev
   ```

3. **Run Tests**
   ```bash
   bun test
   ```

4. **Build for Production**
   ```bash
   bun run build
   ```
   Output will be in `dist/`.

## 📦 Deployment (Netlify)

This project is configured for static hosting.

1. Connect your repository to Netlify.
2. Set Build Command: `bun run build` (or `npm run build`)
3. Set Publish Directory: `dist`
4. Ensure Netlify handles SPA routing (a `_redirects` file is not strictly needed if only using hash routing, but for history mode, add `/* /index.html 200` to `public/_redirects`).

## 🛠 Configuration

- **Teams & Groups**: `src/data/groups.json`
- **Schedule Structure**: `src/data/schedule.json`
- **Stadiums**: `src/data/stadiums.json`

## 🧪 Verification

Run `bun test` to verify the bracket logic and data integrity.
