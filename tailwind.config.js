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
        ivy: {
          50: '#fdf8f6',
          100: '#f9eee9',
          200: '#f3dbd3',
          300: '#e7bfb3',
          400: '#d79b8a',
          500: '#c95565', // Main dusty rose accent
          600: '#b34757',
          700: '#953745',
          800: '#7d303c',
          900: '#672c35',
          950: '#381318',
        },
        cream: {
          50: '#fcfbf7',
          100: '#f8f4eb',
          200: '#efe6d4',
          300: '#e3d2b5',
          400: '#d5b991',
        },
        charcoal: {
          800: '#1e1d24',
          900: '#16151a',
          950: '#0e0d11',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        serif: ['Playfair Display', 'Cormorant Garamond', 'serif'],
        cursive: ['Cormorant Garamond', 'Playfair Display', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(201, 85, 101, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 30px -4px rgba(201, 85, 101, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.05)',
        'rose-glow': '0 0 20px rgba(201, 85, 101, 0.25)',
      }
    },
  },
  plugins: [],
}
