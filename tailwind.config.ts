import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FDF0F0",
          100: "#FBE3E3",
          200: "#F6C5C6",
          600: "#008acaff",
          700: "#A50E1B",
          800: "#860C17",
        },
        cream: {
          DEFAULT: "#FFFBF7",
          dark: "#F7F0E8",
        },
        ink: {
          DEFAULT: "#1C1917",
          soft: "#57534E",
          faint: "#8A7F78",
        },
        line: "#F0E4D8",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 25, 23, 0.04), 0 8px 24px -12px rgba(28, 25, 23, 0.12)",
        pop: "0 12px 32px -12px rgba(193, 18, 31, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
