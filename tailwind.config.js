/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F8F4',
        ink: '#17364B',
        ocean: '#256FA8',
        teal: '#3F9B91',
        lime: '#D8E798',
      },
    },
  },
  plugins: [],
};
