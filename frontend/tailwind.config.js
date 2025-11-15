/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#ea580c', // orange-600
        secondary: '#dc2626', // red-600
        background: '#020617', // slate-950
        foreground: '#f8fafc', // slate-50
        border: '#1e293b', // slate-800
      },
    },
  },
  plugins: [],
};

