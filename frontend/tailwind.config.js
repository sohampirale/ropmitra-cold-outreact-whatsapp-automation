/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0d14',
          800: '#111622',
          700: '#192030',
          600: '#232d42',
        },
        brand: {
          green: '#25D366',
          emerald: '#10B981',
          cyan: '#06B6D4',
        }
      },
      boxShadow: {
        'glow-green': '0 0 25px -5px rgba(37, 211, 102, 0.35)',
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.35)',
      }
    },
  },
  plugins: [],
}
