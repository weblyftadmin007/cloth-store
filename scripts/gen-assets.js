// Generates placeholder SVG product images + hero into public/assets
// Quiet-luxury art direction: tonal garments on warm neutrals, editorial hero.
// Run: node scripts/gen-assets.js
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'assets');
const PDIR = path.join(OUT, 'p');

if (!fs.existsSync(PDIR)) fs.mkdirSync(PDIR, { recursive: true });

const W = 600, H = 750;

// slug, category, garment color, backdrop color
// Palette: muted stone / sage / slate / taupe / oxblood on warm neutrals.
const products = [
  ['classic-cotton-tee', 'Tees', '#c9c2b4', '#f1ece3'],
  ['vintage-logo-tee', 'Tees', '#8a857c', '#efe9df'],
  ['oversized-graphic-tee', 'Tees', '#b3aa98', '#f3efe7'],
  ['striped-crew-tee', 'Tees', '#4a4a45', '#f1ece3'],
  ['pocket-basic-tee', 'Tees', '#a9b0a0', '#f0ebe2'],
  ['essential-hoodie', 'Hoodies', '#9b948a', '#f2ede4'],
  ['pullover-fleece-hoodie', 'Hoodies', '#3e3c39', '#efeae1'],
  ['zip-up-hoodie', 'Hoodies', '#54544e', '#f3efe8'],
  ['heavyweight-oversized-hoodie', 'Hoodies', '#6b6a63', '#f1ece3'],
  ['cropped-hoodie', 'Hoodies', '#c4b6ab', '#f2ede4'],
  ['oxford-button-down-shirt', 'Shirts', '#bcc3c8', '#f0ebe2'],
  ['linen-casual-shirt', 'Shirts', '#d4c5a6', '#f3efe8'],
  ['flannel-check-shirt', 'Shirts', '#6e4640', '#efeae1'],
  ['denim-work-shirt', 'Shirts', '#5f6d7c', '#f1ece3'],
  ['poplin-everyday-shirt', 'Shirts', '#e4e0d7', '#f2ede4'],
  ['bomber-jacket', 'Jackets', '#34342f', '#f0ebe2'],
  ['denim-trucker-jacket', 'Jackets', '#77879a', '#f3efe8'],
  ['puffer-jacket', 'Jackets', '#55564f', '#f1ece3'],
  ['leather-biker-jacket', 'Jackets', '#3a2e28', '#efeae1'],
  ['windbreaker', 'Jackets', '#7d8a80', '#f2ede4'],
  ['relaxed-fit-joggers', 'Bottoms', '#4c4a46', '#f0ebe2'],
  ['stretch-slim-cargo-pants', 'Bottoms', '#8f8a72', '#f3efe8'],
  ['classic-chino-pants', 'Bottoms', '#c2b391', '#f1ece3'],
  ['denim-jeans-straight-fit', 'Bottoms', '#5d7186', '#f2ede4'],
  ['bucket-hat', 'Accessories', '#57584f', '#f0ebe2'],
  ['logo-cap', 'Accessories', '#33322f', '#f3efe8'],
  ['cotton-toque', 'Accessories', '#6e4640', '#f1ece3'],
  ['canvas-tote-bag', 'Accessories', '#d3c3a5', '#efeae1'],
  ['unisex-socks-3-pack', 'Accessories', '#a5a49d', '#f2ede4'],
];

// Garment silhouettes, centered ~ at 300, 350
const SHAPES = {
  Tees: `<path d="M300 260 C 258 250 238 260 224 282 L 188 316 L 224 356 L 252 332 L 252 570 L 348 570 L 348 332 L 376 356 L 412 316 L 376 282 C 362 260 342 250 300 260 Z" fill="VAR"/>`,
  Hoodies: `<path d="M300 250 C 258 240 236 252 220 276 L 182 312 L 220 352 L 250 326 L 250 570 L 350 570 L 350 326 L 380 352 L 418 312 L 380 276 C 364 252 342 240 300 250 Z" fill="VAR"/><rect x="246" y="350" width="108" height="46" rx="12" fill="#00000014"/><path d="M258 264 C 265 232 335 232 342 264" fill="none" stroke="#00000030" stroke-width="10" stroke-linecap="round"/>`,
  Shirts: `<path d="M300 260 C 258 252 240 260 226 282 L 192 314 L 226 354 L 254 330 L 254 570 L 346 570 L 346 330 L 374 354 L 408 314 L 374 282 C 360 260 342 252 300 260 Z" fill="VAR"/><path d="M300 264 L 300 570" stroke="#00000026" stroke-width="3"/><path d="M286 264 L 300 294 L 314 264 Z" fill="#00000018"/>`,
  Jackets: `<path d="M300 258 C 258 250 238 258 224 280 L 190 312 L 224 352 L 252 328 L 252 570 L 348 570 L 348 328 L 376 352 L 410 312 L 376 280 C 362 258 342 250 300 258 Z" fill="VAR"/><path d="M300 266 L 300 570" stroke="#00000026" stroke-width="4"/><rect x="256" y="380" width="40" height="34" rx="6" fill="#00000014"/><rect x="304" y="380" width="40" height="34" rx="6" fill="#00000014"/>`,
  Bottoms: `<path d="M258 350 L 342 350 L 342 570 L 246 570 Z" fill="VAR"/><path d="M300 350 L 300 570" stroke="#00000026" stroke-width="2"/><path d="M246 350 L 300 380 L 342 350" fill="none" stroke="#00000018" stroke-width="3"/><rect x="244" y="480" width="58" height="40" rx="10" fill="#ffffff2e"/><rect x="298" y="480" width="58" height="40" rx="10" fill="#ffffff2e"/>`,
  Accessories: `<path d="M300 260 C 250 260 240 290 234 318 L 180 338 L 200 368 L 234 358 L 234 450 C 250 468 298 474 300 474 C 302 474 350 468 366 450 L 366 358 L 400 368 L 420 338 L 366 318 C 360 290 350 260 300 260 Z" fill="VAR"/><path d="M200 368 L 400 368" stroke="#00000022" stroke-width="3"/><rect x="262" y="402" width="76" height="30" rx="8" fill="#00000014"/>`,
};

function svgFor(slug, category, color, bg) {
  const shape = (SHAPES[category] || SHAPES.Tees).replace(/VAR/g, color);
  const label = slug.replace(/-/g, ' ').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="#1d1c1a1a" stroke-width="1"/>
  <g transform="translate(0 20)">${shape}</g>
  <text x="${W / 2}" y="${H - 58}" font-family="Georgia, 'Times New Roman', serif" font-size="21" letter-spacing="6" text-anchor="middle" fill="#1d1c1a">${label}</text>
  <text x="${W / 2}" y="${H - 30}" font-family="Helvetica, Arial, sans-serif" font-size="12" letter-spacing="5" text-anchor="middle" fill="#8a857c">${category.toUpperCase()}</text>
</svg>`;
}

for (const [slug, category, color, bg] of products) {
  fs.writeFileSync(path.join(PDIR, slug + '.svg'), svgFor(slug, category, color, bg));
  console.log('wrote', 'p/' + slug + '.svg');
}

// Editorial hero: warm stone, thin frame, fine-line hanger, serif wordmark
const hero = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="900" viewBox="0 0 800 900">
  <rect width="800" height="900" fill="#efeae1"/>
  <rect x="28" y="28" width="744" height="844" fill="none" stroke="#1d1c1a1f" stroke-width="1"/>
  <circle cx="400" cy="330" r="34" fill="none" stroke="#1d1c1a" stroke-width="2.5"/>
  <path d="M400 364 L 620 505 L 180 505 Z" fill="none" stroke="#1d1c1a" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M180 505 L 620 505" stroke="#1d1c1a" stroke-width="2.5"/>
  <text x="400" y="640" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="500" letter-spacing="14" text-anchor="middle" fill="#1d1c1a">ATELIER</text>
  <text x="400" y="700" font-family="Helvetica, Arial, sans-serif" font-size="15" letter-spacing="9" text-anchor="middle" fill="#8a857c">ESSENTIALS IN EVERY STITCH</text>
  <rect x="330" y="740" width="140" height="1" fill="#9a7b4f"/>
</svg>`;
fs.writeFileSync(path.join(OUT, 'hero.svg'), hero);
console.log('wrote hero.svg');
