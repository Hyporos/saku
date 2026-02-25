/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        karla: ["Karla", "sans-serif"],
      },
      colors: {
        background: "#292A30",
        panel: "#222328",
        accent: "#FFC3C6",
        tertiary: "#C2C2C2",
      },
    },
  },
  plugins: [],
};
