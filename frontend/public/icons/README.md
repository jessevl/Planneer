# PWA Icons

This directory should contain app icons in various sizes for PWA and native app support.

## Required Icons

### Standard Icons (for manifest.json)
- `icon-72.png` - 72x72px
- `icon-96.png` - 96x96px
- `icon-128.png` - 128x128px
- `icon-144.png` - 144x144px
- `icon-152.png` - 152x152px
- `icon-167.png` - 167x167px (iPad Pro)
- `icon-180.png` - 180x180px (iPhone)
- `icon-192.png` - 192x192px
- `icon-384.png` - 384x384px
- `icon-512.png` - 512x512px

### Maskable Icons (for Android adaptive icons)
- `icon-maskable-192.png` - 192x192px with safe zone padding
- `icon-maskable-512.png` - 512x512px with safe zone padding

### Favicon
- `icon-16.png` - 16x16px
- `icon-32.png` - 32x32px

### Shortcut Icons
- `shortcut-today.png` - 96x96px (Today's Tasks shortcut)
- `shortcut-inbox.png` - 96x96px (Inbox shortcut)
- `shortcut-note.png` - 96x96px (New Note shortcut)
- `shortcut-journal.png` - 96x96px (Daily Journal shortcut)

## Generating Icons

### Using a Master Icon

1. Create a high-resolution master icon (at least 1024x1024px)
2. Use a tool like [pwa-asset-generator](https://github.com/nicolomaioli/pwa-asset-generator) or [realfavicongenerator.net](https://realfavicongenerator.net/)

```bash
# Using pwa-asset-generator (recommended)
npx pwa-asset-generator master-icon.png ./public/icons --index ./index.html --manifest ./public/manifest.json
```

### Maskable Icon Guidelines

Maskable icons need extra padding because different devices crop them differently:
- Keep important content within the center 80% of the icon
- Use a solid background color that extends to the edges
- Test with [Maskable.app](https://maskable.app/)

## Dark Mode Icons (Optional)

For better dark mode support, you can provide alternate icons:
- Add `icon-*-dark.png` variants
- Handle dynamically in JavaScript based on `prefers-color-scheme`

## Placeholder

Until you create proper icons, you can use placeholder icons. Here's a simple SVG you can use as a base:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb" rx="64"/>
  <text x="256" y="320" text-anchor="middle" fill="white" font-size="200" font-family="system-ui, sans-serif" font-weight="bold">P</text>
</svg>
```
