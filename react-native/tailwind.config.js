/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#ea580c', // orange-600
        secondary: '#dc2626', // red-600
        background: '#020617', // slate-950
        foreground: '#f8fafc', // slate-50
        border: '#1e293b', // slate-800
        'light-bg': '#d2d3db', // rgb(210,211,219) - main light background
        'light-bg-alt': '#e4e5f1', // rgb(228,229,241) - alternative light background
      },
    },
  },
  plugins: [],
};

