/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
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
        accent: {
          50: "#f1f7f5",
          100: "#dcebe5",
          200: "#bad7cc",
          300: "#8fbcab",
          400: "#629a86",
          500: "#467d6b",
          600: "#356456",
          700: "#2c5047",
          800: "#26413a",
          900: "#213632",
        },
        cream: "#fbf7f1",
        ink: "#211b16",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "ui-serif", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(88, 41, 27, 0.08), 0 4px 24px -6px rgba(88, 41, 27, 0.08)",
        lift: "0 12px 32px -10px rgba(88, 41, 27, 0.22), 0 6px 14px -8px rgba(88, 41, 27, 0.16)",
        glow: "0 0 0 1px rgba(168, 74, 32, 0.12), 0 18px 40px -16px rgba(168, 74, 32, 0.35)",
      },
      backgroundImage: {
        "grain":
          "radial-gradient(circle at 20% 20%, rgba(168,74,32,0.06) 0, transparent 45%), radial-gradient(circle at 80% 0%, rgba(70,125,107,0.06) 0, transparent 40%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-22px) rotate(3deg)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.7s ease both",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        "spin-slow": "spin-slow 14s linear infinite",
      },
    },
  },
  plugins: [],
};
