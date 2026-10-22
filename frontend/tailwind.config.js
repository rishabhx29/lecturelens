/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./demo/index.html", "./src/**/*.{js,ts,jsx,tsx}", "./demo/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F4F0E6",
          light: "#FBF8F1",
          deep: "#EAE3D5",
        },
        ink: {
          DEFAULT: "#141518",
          soft: "#57544D",
          muted: "#6E6A61",
        },
        line: {
          DEFAULT: "#D8D0C0",
          soft: "#E7E0D3",
        },
        cobalt: {
          DEFAULT: "#2748FF",
          dark: "#1B34C9",
          soft: "#E9EDFF",
        },
        lime: {
          DEFAULT: "#DDF46F",
          soft: "#F0F8C8",
        },
        moss: "#217A57",
        coral: "#A93E2D",
        amber: "#8C5B12",
      },
      fontFamily: {
        display: [
          '"Bricolage Grotesque Variable"',
          '"Bricolage Grotesque"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          '"Geist Variable"',
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"Geist Mono Variable"',
          '"Geist Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 0 rgba(20, 21, 24, 0.04), 0 14px 30px -24px rgba(20, 21, 24, 0.28)",
        lift: "0 24px 50px -30px rgba(20, 21, 24, 0.4)",
        soft: "0 8px 20px -14px rgba(20, 21, 24, 0.28)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.985)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { opacity: "0.25", transform: "translateY(0)" },
          "30%": { opacity: "1", transform: "translateY(-3px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.65s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        shimmer: "shimmer 1.8s linear infinite",
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
      },
    },
    container: {
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        md: "2rem",
        lg: "3rem",
        xl: "4rem",
      },
      center: true,
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
