/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
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

