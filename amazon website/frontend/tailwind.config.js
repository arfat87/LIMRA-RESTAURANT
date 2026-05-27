/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF9900',
          50: '#FFF7E6',
          100: '#FFEDCC',
          200: '#FFDB99',
          300: '#FFC966',
          400: '#FFB733',
          500: '#FF9900',
          600: '#CC7A00',
          700: '#995C00',
          800: '#663D00',
          900: '#331F00',
        },
        secondary: {
          DEFAULT: '#232F3E',
          dark: '#131921',
        },
        accent: '#FFD814',
        surface: '#1F2937',
        border: '#374151',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #131921 0%, #232F3E 50%, #131921 100%)',
      },
    },
  },
  plugins: [],
}
