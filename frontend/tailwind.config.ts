import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
          900: '#1e1b4b',
        },
        success: { 100: '#dcfce7', 500: '#22c55e', 700: '#15803d' },
        warning: { 100: '#fef9c3', 500: '#eab308', 700: '#a16207' },
        danger: { 100: '#fee2e2', 500: '#ef4444', 700: '#b91c1c' },
      },
    },
  },
  plugins: [],
} satisfies Config;
