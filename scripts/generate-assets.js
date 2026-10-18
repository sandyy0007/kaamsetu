const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B192C" />
      <stop offset="100%" stop-color="#0D9488" />
    </linearGradient>
    <linearGradient id="path" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#FCD34D" />
    </linearGradient>
    <linearGradient id="teal" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#14B8A6" />
      <stop offset="100%" stop-color="#5EEAD4" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" fill="url(#bg)" />
  <path d="M85 405 C 170 298, 341 298, 426 405" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="32" stroke-linecap="round" />
  <rect x="117" y="117" width="58" height="278" rx="29" fill="#FFFFFF" />
  <path d="M181 256 C 224 256, 288 192, 373 138" fill="none" stroke="url(#path)" stroke-width="58" stroke-linecap="round" />
  <path d="M181 256 C 234 256, 298 320, 384 374" fill="none" stroke="url(#teal)" stroke-width="58" stroke-linecap="round" />
  <circle cx="373" cy="138" r="26" fill="#F59E0B" />
</svg>
`;

const roundIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B192C" />
      <stop offset="100%" stop-color="#0D9488" />
    </linearGradient>
    <linearGradient id="path" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#FCD34D" />
    </linearGradient>
    <linearGradient id="teal" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#14B8A6" />
      <stop offset="100%" stop-color="#5EEAD4" />
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#bg)" />
  <path d="M85 405 C 170 298, 341 298, 426 405" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="32" stroke-linecap="round" />
  <rect x="117" y="117" width="58" height="278" rx="29" fill="#FFFFFF" />
  <path d="M181 256 C 224 256, 288 192, 373 138" fill="none" stroke="url(#path)" stroke-width="58" stroke-linecap="round" />
  <path d="M181 256 C 234 256, 298 320, 384 374" fill="none" stroke="url(#teal)" stroke-width="58" stroke-linecap="round" />
  <circle cx="373" cy="138" r="26" fill="#F59E0B" />
</svg>
`;

const foregroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="path" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#FCD34D" />
    </linearGradient>
    <linearGradient id="teal" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#14B8A6" />
      <stop offset="100%" stop-color="#5EEAD4" />
    </linearGradient>
  </defs>
  <g transform="translate(80, 80) scale(0.6875)">
    <path d="M85 405 C 170 298, 341 298, 426 405" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="36" stroke-linecap="round" />
    <rect x="117" y="117" width="58" height="278" rx="29" fill="#FFFFFF" />
    <path d="M181 256 C 224 256, 288 192, 373 138" fill="none" stroke="url(#path)" stroke-width="58" stroke-linecap="round" />
    <path d="M181 256 C 234 256, 298 320, 384 374" fill="none" stroke="url(#teal)" stroke-width="58" stroke-linecap="round" />
    <circle cx="373" cy="138" r="26" fill="#F59E0B" />
  </g>
</svg>
`;

function createSplashSvg(width, height) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="splash-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#08101D" />
      <stop offset="50%" stop-color="#0B192C" />
      <stop offset="100%" stop-color="#071E28" />
    </linearGradient>
    <linearGradient id="ks-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B192C" />
      <stop offset="100%" stop-color="#0D9488" />
    </linearGradient>
    <linearGradient id="ks-path" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#FCD34D" />
    </linearGradient>
    <linearGradient id="ks-teal" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#14B8A6" />
      <stop offset="100%" stop-color="#5EEAD4" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#splash-bg)" />
  <g transform="translate(${Math.round(width / 2 - 64)}, ${Math.round(height / 2 - 96)})">
    <rect width="128" height="128" rx="32" fill="url(#ks-bg)" />
    <path d="M21 101 C 42 74, 85 74, 106 101" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8" stroke-linecap="round" />
    <rect x="29" y="29" width="14.5" height="69.5" rx="7.25" fill="#FFFFFF" />
    <path d="M45 64 C 56 64, 72 48, 93 34" fill="none" stroke="url(#ks-path)" stroke-width="14.5" stroke-linecap="round" />
    <path d="M45 64 C 58 64, 74 80, 96 93" fill="none" stroke="url(#ks-teal)" stroke-width="14.5" stroke-linecap="round" />
    <circle cx="93" cy="34" r="6.5" fill="#F59E0B" />
  </g>
  <text x="${Math.round(width / 2)}" y="${Math.round(height / 2 + 64)}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="28" fill="#FFFFFF" letter-spacing="1">KaamSetu</text>
  <text x="${Math.round(width / 2)}" y="${Math.round(height / 2 + 96)}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="14" fill="#14B8A6" letter-spacing="0.5">काम से पहचान, हुनर से अवसर</text>
</svg>
`;
}

async function run() {
  console.log("Generating KaamSetu branding assets...");

  const mipmaps = [
    { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(resDir, m.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    await sharp(Buffer.from(iconSvg))
      .resize(m.iconSize, m.iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    await sharp(Buffer.from(roundIconSvg))
      .resize(m.iconSize, m.iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    await sharp(Buffer.from(foregroundSvg))
      .resize(m.fgSize, m.fgSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated launcher icons in ${m.dir}`);
  }

  // Splash screens
  const splashes = [
    { dir: 'drawable', w: 480, h: 800 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  ];

  for (const s of splashes) {
    const targetDir = path.join(resDir, s.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const svg = createSplashSvg(s.w, s.h);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(targetDir, 'splash.png'));

    console.log(`Generated splash in ${s.dir} (${s.w}x${s.h})`);
  }

  console.log("All Android branding assets successfully generated!");
}

run().catch((e) => {
  console.error("Asset generation error:", e);
  process.exit(1);
});

