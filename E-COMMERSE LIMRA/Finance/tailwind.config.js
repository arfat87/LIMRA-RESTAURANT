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
        primary: {
          50: '#f0f4ff',
          100: '#e1eaff',
          200: '#c8daff',
          300: '#a1c0ff',
          400: '#719bff',
          500: '#3b6bf6', // Deep Blue Primary
          600: '#254deb',
          700: '#1d3ad7',
          800: '#1e32ae',
          900: '#1e2e8a',
        },
        emerald: {
          500: '#10b981', // Accent Emerald Green
        },
        amber: {
          500: '#f59e0b', // Warning Amber
        },
        red: {
          500: '#ef4444', // Error Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
