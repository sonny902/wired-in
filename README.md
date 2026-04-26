# Wired In ⚡

Zero gap focus. Two modes. No overlap.

## Deploy in 5 minutes

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "wired in v1"
git remote add origin https://github.com/YOUR_USERNAME/wired-in.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to vercel.com → New Project
2. Import your `wired-in` GitHub repo
3. Framework: **Vite** (auto-detected)
4. Hit Deploy

That's it. Live URL in ~60 seconds.

## Local dev
```bash
npm install
npm run dev
```

## Features v1
- Two fully customisable modes (name + colour)
- Zero-gap task scheduling with live start/end times
- Persistent storage (localStorage)
- Progress tracking per mode
- PWA — add to home screen on mobile
- Flip animation between modes
- Current task indicator with progress bar
