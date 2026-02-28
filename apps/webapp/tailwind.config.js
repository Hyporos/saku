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
      keyframes: {
        lbIn: {
          from: { opacity: "0", transform: "scale(0.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        lbOut: {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.94)" },
        },
      },
      animation: {
        "lb-in": "lbIn 0.18s ease-out",
        "lb-out": "lbOut 0.15s ease-in forwards",
      },
    },
  },
  plugins: [],
};
