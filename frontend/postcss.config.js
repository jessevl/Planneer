export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {
      overrideBrowserslist: [
        'last 2 versions',
        'not dead',
        '> 0.2%',
        'Firefox ESR',  // Add explicit support for Firefox
        'not IE 11'     // Exclude old IE
      ],
      flexbox: 'no-2009',
      // Ensure both prefixed and unprefixed properties are added
      add: true,
      remove: false
    },
  },
}
