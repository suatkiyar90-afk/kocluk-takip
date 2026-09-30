const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const VIEWBOX = 512;

function buildSvg({ rounded }) {
  const rx = rounded ? 112 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEWBOX}" height="${VIEWBOX}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" rx="${rx}" fill="url(#bg)"/>
  <g transform="translate(109.5 48) scale(12.2)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>
  <g fill="#ffffff">
    <rect x="170" y="356" width="46" height="64" rx="14" opacity="0.72"/>
    <rect x="233" y="332" width="46" height="88" rx="14" opacity="0.86"/>
    <rect x="296" y="308" width="46" height="112" rx="14"/>
  </g>
</svg>`;
}

const roundedSvg = buildSvg({ rounded: true });
const flatSvg = buildSvg({ rounded: false });

const targets = [
  { file: "icon-192x192.png", size: 192, svg: roundedSvg },
  { file: "icon-512x512.png", size: 512, svg: roundedSvg },
  { file: "icon-maskable-512x512.png", size: 512, svg: flatSvg },
  { file: "apple-touch-icon.png", size: 180, svg: flatSvg },
];

const outDir = path.join(__dirname, "..", "public");

(async () => {
  for (const target of targets) {
    const outPath = path.join(outDir, target.file);
    await sharp(Buffer.from(target.svg))
      .resize(target.size, target.size)
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    const meta = await sharp(outPath).metadata();
    const stats = await sharp(outPath).stats();
    const mean = stats.channels
      .slice(0, 3)
      .map((c) => Math.round(c.mean))
      .join(",");
    console.log(
      `${target.file}: ${meta.width}x${meta.height} ${meta.format} ${fs.statSync(outPath).size} bytes meanRGB=${mean}`,
    );
  }
  console.log("OK");
})().catch((err) => {
  console.error("HATA:", err.message);
  process.exit(1);
});
