// Design tokens: palette (ink/ivory/saffron + status), type stacks, radii, shadows. Used everywhere via utility classes.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0A1224', 900: '#0F1B33', 800: '#172746', 700: '#243659', 600: '#3B4D74', 400: '#6B7CA0', 300: '#9AA8C4' },
        ivory: { 50: '#FDFBF6', 100: '#F8F4EA', 200: '#EEE8D8', 300: '#E0D8C3', 400: '#CFC5AB' },
        saffron: { 100: '#FCEBD3', 400: '#F2A04A', 500: '#E8832A', 600: '#C96A16', 700: '#9C500F' },
        moss: { 100: '#DCEBDD', 600: '#2F7A4F', 700: '#245F3E' },
        warn: { 100: '#F6E8C1', 600: '#A8700A', 700: '#7F5407' },
        brick: { 100: '#F8DCD6', 600: '#B4382B', 700: '#8F2A20' },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Devanagari"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['"Source Serif 4"', '"Noto Serif Devanagari"', 'Georgia', 'serif'],
      },
      borderRadius: { panel: '10px' },
      boxShadow: { pop: '0 24px 60px -20px rgba(10,18,36,.45)', lift: '0 10px 30px -18px rgba(10,18,36,.35)' },
      keyframes: { shimmer: { '0%': { opacity: '.55' }, '50%': { opacity: '1' }, '100%': { opacity: '.55' } } },
      animation: { shimmer: 'shimmer 1.4s ease-in-out infinite' },
    },
  },
  plugins: [],
};
