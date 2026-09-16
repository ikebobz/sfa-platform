/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2A4A",
        "ink-soft": "#55607A",
        paper: "#EEF0EA",
        panel: "#FFFFFF",
        border: "#D9DAC9",
        accent: "#C1852B",
        good: "#2F6F62",
        "good-bg": "#E3EDE9",
        watch: "#B5651D",
        "watch-bg": "#F3E6D6",
        poor: "#9E3B33",
        "poor-bg": "#F0DCD9",
        track: "#F1F1E8",
      },
      fontFamily: {
        serif: ["Source Serif 4", "Georgia", "serif"],
        sans: ["IBM Plex Sans", "Segoe UI", "Arial", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "4px",
      },
    },
  },
  plugins: [],
};
