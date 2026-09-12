/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7ff',
          100: '#e6efff',
          200: '#c2d9ff',
          300: '#9ec2ff',
          400: '#5794ff',
          500: '#1066ff',
          600: '#0e5ce6',
          700: '#0b49b3',
          800: '#083780',
          900: '#06264d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(16, 102, 255, 0.25)',
      },
    },
  },
  plugins: [],
};
