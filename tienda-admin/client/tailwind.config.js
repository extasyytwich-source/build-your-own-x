/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#18181b',
          600: '#09090b',
          700: '#000000',
          800: '#000000',
          900: '#000000',
        },
        // Paleta oscura exclusiva de la landing (Landing.jsx y sus
        // subcomponentes en components/landing/) — el panel autenticado
        // sigue con su tema claro de siempre, sin tocar `brand` ni el resto.
        night: {
          bg: '#0F0D1F',
          card: '#1C1838',
          border: '#2A2550',
        },
        iris: '#7F77DD',
        coral: '#F0997B',
        aqua: '#5DCAA5',
        golden: '#FAC775',
        blossom: '#ED93B1',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Tipografías del rediseño de la landing — separadas de `sans` para
        // no afectar el panel autenticado, que sigue usando Inter.
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        playfair: ['"Playfair Display"', 'serif'],
        syne: ['Syne', 'system-ui', 'sans-serif'],
        instrument: ['"Instrument Serif"', 'serif'],
        jetbrains: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(0, 0, 0, 0.35)',
        glow: '0 0 40px -8px rgba(127, 119, 221, 0.45)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
      },
      animation: {
        marquee: 'marquee 24s linear infinite',
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
