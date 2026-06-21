/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf6f0",
          100: "#f9e6d8",
          200: "#f0c9ad",
          300: "#e4a578",
          400: "#d77f48",
          500: "#c5612b",
          600: "#a84a20",
          700: "#86391d",
          800: "#6c2f1d",
          900: "#58291b",
        },
      },
      fontFamily: {
        display: ["Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};
