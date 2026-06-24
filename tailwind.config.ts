import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hud: "#00ff41",
        "hud-dim": "#00aa2a",
        "hud-dark": "#003310",
        "hud-dust": "#d4ddd6",
      },
      fontFamily: {
        mono: [
          "IBM Plex Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
        serif: [
          "Newsreader",
          "Georgia",
          "serif",
        ],
        "serif-title": [
          "Instrument Serif",
          "Georgia",
          "serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
