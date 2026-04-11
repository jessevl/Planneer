/**
 * Generate PNG icons from SVG for PWA and iOS
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

// Read the source SVGs
const svgPath = join(iconsDir, 'app-icon.svg');
const svgSmallPath = join(iconsDir, 'app-icon-small.svg');
const svgNoBackdropPath = join(iconsDir, 'app-icon-no-backdrop.svg');
const svgOutlinePath = join(iconsDir, 'app-icon-outline.svg');
const svgContent = readFileSync(svgPath);
const svgSmallContent = readFileSync(svgSmallPath);
const svgNoBackdropContent = readFileSync(svgNoBackdropPath);
const svgOutlineContent = readFileSync(svgOutlinePath);

// Sizes needed for iOS and PWA
// Small sizes (32 and below) use the simplified single-page icon
const smallSizes = [16, 32];
const largeSizes = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512];
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
  console.log('Generating PNG icons...');
  
  // Generate small icons from simplified SVG
  for (const size of smallSizes) {
    const outputPath = join(iconsDir, `icon-${size}.png`);
    
    await sharp(svgSmallContent)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`  ✓ icon-${size}.png (small variant)`);
  }
  
  // Generate large icons from full SVG
  for (const size of largeSizes) {
    const outputPath = join(iconsDir, `icon-${size}.png`);
    
    await sharp(svgContent)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`  ✓ icon-${size}.png`);
  }

  for (const size of variantSizes) {
    await sharp(svgNoBackdropContent)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-no-backdrop-${size}.png`));

    await sharp(svgOutlineContent)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-outline-${size}.png`));

    console.log(`  ✓ icon-no-backdrop-${size}.png`);
    console.log(`  ✓ icon-outline-${size}.png`);
  }
  
  // Also generate maskable icons (with padding for safe area)
  const maskableSizes = [192, 512];
  for (const size of maskableSizes) {
    const outputPath = join(iconsDir, `icon-maskable-${size}.png`);
    
    // Maskable icons need extra padding (safe area is 80% of the icon)
    const innerSize = Math.round(size * 0.8);
    const padding = Math.round((size - innerSize) / 2);
    
    const iconBuffer = await sharp(svgContent)
      .resize(innerSize, innerSize)
      .png()
      .toBuffer();

    await sharp(createMaskableBackground(size))
      .composite([{ input: iconBuffer, left: padding, top: padding }])
      .png()
      .toFile(outputPath);
    
    console.log(`  ✓ icon-maskable-${size}.png`);
  }
  
  // Generate favicon.ico (use simplified small variant for clarity)
  const faviconPath = join(__dirname, '../public/favicon.ico');
  await sharp(svgSmallContent)
    .resize(32, 32)
    .png()
    .toFile(join(iconsDir, 'favicon.png'));
  console.log('  ✓ favicon.png (small variant)');
  
  console.log('\nDone! Icons generated successfully.');
}

generateIcons().catch(console.error);
