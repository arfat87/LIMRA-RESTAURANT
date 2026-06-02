/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B4F30',
          light: '#136740',
          dark: '#063B23'
        },
        gold: {
          DEFAULT: '#C29B38',
          light: '#D4AF37',
          dark: '#A07E2A'
        },
        offwhite: '#FAF9F6',
        dark: '#121212',
        surface: '#1E1E1E'
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif']
      },
      boxShadow: {
        premium: '0 8px 30px rgb(0 0 0 / 0.06)',
        native: '0 -2px 15px rgb(0 0 0 / 0.04)'
      }
    }
  },
  plugins: []
}
