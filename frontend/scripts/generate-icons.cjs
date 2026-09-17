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
const MASKABLE_SOURCE_SVG = path.join(ICONS_DIR, 'app-icon-maskable.svg');

// Sizes to generate
const smallSizes = [16, 32];
const largeSizes = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512];
const maskableSizes = [192, 512];
const variantSizes = [192, 512];

async function generateIcons() {
  console.log('Reading source SVG...');
  const svgBuffer = fs.readFileSync(SOURCE_SVG);
  const smallSvgBuffer = fs.readFileSync(SMALL_SOURCE_SVG);
  const noBackdropSvgBuffer = fs.readFileSync(NO_BACKDROP_SOURCE_SVG);
  const outlineSvgBuffer = fs.readFileSync(OUTLINE_SOURCE_SVG);
  const maskableSvgBuffer = fs.readFileSync(MASKABLE_SOURCE_SVG);

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

  // Plateless artwork, generated at every manifest size. These are the
  // `purpose: "any"` icons: desktop Chrome/Edge use them for the Windows
  // taskbar and Start shortcut, where a baked-in container would sit awkwardly
  // inside the chrome's own framing. Android prefers the maskable set below.
  for (const size of largeSizes) {
    console.log(`Generating icon-no-backdrop-${size}.png...`);
    await sharp(noBackdropSvgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-no-backdrop-${size}.png`));
  }

  for (const size of variantSizes) {
    console.log(`Generating icon-outline-${size}.png...`);
    await sharp(outlineSvgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-outline-${size}.png`));
  }

  // Maskable icons are their own artwork: full-bleed background (the OS applies
  // its own mask, so no rounded corners here) with the object already scaled
  // into the safe zone. Rendered directly rather than composited, so it keeps
  // the same glass material as the other icons.
  for (const size of maskableSizes) {
    const outputPath = path.join(ICONS_DIR, `icon-maskable-${size}.png`);
    console.log(`Generating maskable ${size}x${size}...`);
    await sharp(maskableSvgBuffer)
      .resize(size, size)
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
