/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#63b3ed', dark: '#3182ce' },
        surface: { DEFAULT: '#1a1d26', card: '#22263a', border: 'rgba(255,255,255,0.08)' },
        bg: { DEFAULT: '#0f1117' },
        success: '#48bb78',
        warning: '#f6ad55',
        danger: '#fc8181',
        'text-primary': '#e8eaf0',
        'text-secondary': '#9099aa',
        'text-muted': '#5a6170',
      },
      fontFamily: {
        sans: ['IBMPlexSans_400Regular', 'System'],
        medium: ['IBMPlexSans_500Medium', 'System'],
        bold: ['IBMPlexSans_700Bold', 'System'],
        arabic: ['IBMPlexSansArabic_400Regular', 'System'],
      },
    },
  },
};
