import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0E1726", // page background
          900: "#162138", // panels
          800: "#1D2B47", // hover / borders base
          700: "#2A3B5E",
        },
        accent: {
          DEFAULT: "#E8B86D",
          dark: "#C9974A",
        },
        ink: {
          DEFAULT: "#E6EAF2",
          muted: "#8B96AB",
        },
      },
      fontFamily: {
        sans: ["var(--font-plex-arabic)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        panel: "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
