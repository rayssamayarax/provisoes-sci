/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#d9e2ef",
        input: "#d9e2ef",
        ring: "#0f766e",
        background: "#f4f7fb",
        foreground: "#0f172a",
        primary: {
          DEFAULT: "#0f766e",
          foreground: "#f8fafc",
        },
        muted: {
          DEFAULT: "#edf2f7",
          foreground: "#64748b",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
        destructive: {
          DEFAULT: "#b91c1c",
          foreground: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
