/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: '#1A1A2E',
          50: '#2D2D4E',
          100: '#252540',
          200: '#1A1A2E',
          300: '#12121F',
        },
        accent: {
          DEFAULT: '#E94560',
          50: '#FDE8EC',
          100: '#FBBCC6',
          200: '#F68FA0',
          300: '#F06279',
          400: '#E94560',
          500: '#D63050',
          600: '#C21B3E',
          700: '#9E142F',
        },
        gold: {
          DEFAULT: '#F5A623',
          50: '#FEF3DC',
          100: '#FDE4A8',
          200: '#FBD074',
          300: '#F8BC40',
          400: '#F5A623',
          500: '#D98B0C',
        },
        surface: '#F8F9FA',
        brand: {
          primary: '#1A1A2E',
          accent: '#E94560',
          gold: '#F5A623',
        },
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        devanagari: ['"Noto Sans Devanagari"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-in',
        'fade-in': 'fadeIn 0.4s ease-out',
        shimmer: 'shimmer 1.5s infinite',
        'bounce-subtle': 'bounceSoft 2s infinite',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      backgroundImage: {
        'gradient-midnight': 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
        'gradient-accent': 'linear-gradient(135deg, #E94560 0%, #C73652 100%)',
        'gradient-gold': 'linear-gradient(135deg, #F5A623 0%, #D98B0C 100%)',
        shimmer: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 30px rgba(0,0,0,0.15)',
        accent: '0 4px 20px rgba(233, 69, 96, 0.3)',
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
};
