import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0F19",
        bitcoin: "#F7931A",
        mint: "#10B981",
      },
    },
  },
  plugins: [],
} satisfies Config;
