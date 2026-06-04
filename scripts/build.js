// Cross-platform build: copy the web app into dist/ (replaces the
// Windows-only robocopy script so the build also runs on macOS for the
// iOS port). Mirrors index.html + js/ + css/ into dist/, which Capacitor
// uses as webDir.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

// Start from a clean dist so removed source files don't linger.
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
fs.cpSync(path.join(root, 'js'), path.join(dist, 'js'), { recursive: true });
fs.cpSync(path.join(root, 'css'), path.join(dist, 'css'), { recursive: true });

console.log('Build complete -> dist/ (index.html, js/, css/)');
