/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4fb",
          100: "#d9e6f5",
          200: "#b8cfeb",
          300: "#8ab1dd",
          400: "#6895cb",
          500: "#4a7ab5",
          600: "#3b6399",
          700: "#2f4f7a",
          800: "#1e3454",
          900: "#142640",
          950: "#0b1726",
        },
        accent: {
          400: "#5acece",
          500: "#40b8b8",
          600: "#2f9e9e",
        },
      },
    },
  },
  plugins: [],
};
