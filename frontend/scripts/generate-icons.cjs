/**
 * Generate PNG icons from SVG source
 * 
 * Usage: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');
const SOURCE_SVG = path.join(ICONS_DIR, 'app-icon.svg');
const SMALL_SOURCE_SVG = path.join(ICONS_DIR, 'app-icon-small.svg');
const NO_BACKDROP_SOURCE_SVG = path.join(ICONS_DIR, 'app-icon-no-backdrop.svg');
const OUTLINE_SOURCE_SVG = path.join(ICONS_DIR, 'app-icon-outline.svg');

// Sizes to generate
const smallSizes = [16, 32];
const largeSizes = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512];
const maskableSizes = [192, 512];
const variantSizes = [192, 512];

function createMaskableBackground(size) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="${size}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#fbfbfb"/>
          <stop offset="1" stop-color="#ebeceb"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
    </svg>
  `);
}

async function generateIcons() {
  console.log('Reading source SVG...');
  const svgBuffer = fs.readFileSync(SOURCE_SVG);
  const smallSvgBuffer = fs.readFileSync(SMALL_SOURCE_SVG);
  const noBackdropSvgBuffer = fs.readFileSync(NO_BACKDROP_SOURCE_SVG);
  const outlineSvgBuffer = fs.readFileSync(OUTLINE_SOURCE_SVG);

  // Generate small icons from the no-backdrop artwork
  for (const size of smallSizes) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}.png`);
    console.log(`Generating ${size}x${size}...`);
    
    await sharp(smallSvgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
  }

  // Generate regular icons from the squircle-backed artwork
  for (const size of largeSizes) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}.png`);
    console.log(`Generating ${size}x${size}...`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
  }

  // Generate exportable PNG versions of the additional variants
  for (const size of variantSizes) {
    await sharp(noBackdropSvgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-no-backdrop-${size}.png`));

    await sharp(outlineSvgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-outline-${size}.png`));

    console.log(`Generating icon-no-backdrop-${size}.png...`);
    console.log(`Generating icon-outline-${size}.png...`);
  }

  // Generate maskable icons (with padding for safe zone)
  for (const size of maskableSizes) {
    const outputPath = path.join(ICONS_DIR, `icon-maskable-${size}.png`);
    console.log(`Generating maskable ${size}x${size}...`);
    
    // Maskable icons need 10% padding on all sides for the safe zone
    const innerSize = Math.round(size * 0.8);
    const padding = Math.round(size * 0.1);
    
    const iconBuffer = await sharp(svgBuffer)
      .resize(innerSize, innerSize)
      .png()
      .toBuffer();
    
    await sharp(createMaskableBackground(size))
      .composite([{
        input: iconBuffer,
        left: padding,
        top: padding
      }])
      .png()
      .toFile(outputPath);
  }

  await sharp(smallSvgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(ICONS_DIR, 'favicon.png'));

  console.log('Done! All icons generated.');
}

generateIcons().catch(console.error);
