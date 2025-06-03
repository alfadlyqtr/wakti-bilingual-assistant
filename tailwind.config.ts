
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "100%",
        md: "100%",
        lg: "100%",
        xl: "100%",
        "2xl": "100%",
      },
    },
    extend: {
      colors: {
        // WAKTI Theme Colors
        "dark-bg": "#0c0f14",
        "dark-secondary": "#606062",
        "dark-tertiary": "#858384",
        "light-bg": "#fcfefd",
        "light-primary": "#060541",
        "light-secondary": "#e9ceb0",
        
        // Enhanced vibrant accent colors
        "accent-blue": "hsl(var(--accent-blue))",
        "accent-green": "hsl(var(--accent-green))",
        "accent-orange": "hsl(var(--accent-orange))",
        "accent-purple": "hsl(var(--accent-purple))",
        "accent-pink": "hsl(var(--accent-pink))",
        "accent-cyan": "hsl(var(--accent-cyan))",
        "accent-amber": "hsl(var(--accent-amber))",
        "accent-emerald": "hsl(var(--accent-emerald))",
        
        // UI Elements
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-secondary": "var(--gradient-secondary)",
        "gradient-card": "var(--gradient-card)",
        "gradient-background": "var(--gradient-background)",
        "gradient-nav": "var(--gradient-nav)",
        "gradient-vibrant": "var(--gradient-vibrant)",
        "gradient-warm": "var(--gradient-warm)",
        "gradient-cool": "var(--gradient-cool)",
      },
      boxShadow: {
        "colored": "var(--shadow-colored)",
        "soft": "var(--shadow-soft)",
        "glow": "var(--glow-primary)",
        "glow-blue": "var(--glow-blue)",
        "glow-green": "var(--glow-green)",
        "glow-orange": "var(--glow-orange)",
        "glow-purple": "var(--glow-purple)",
        "vibrant": "var(--shadow-vibrant)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "var(--shadow-soft)" },
          "50%": { boxShadow: "var(--glow-primary), var(--shadow-colored)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-color": {
          "0%, 100%": { transform: "scale(1)", filter: "brightness(1)" },
          "50%": { transform: "scale(1.05)", filter: "brightness(1.2)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "pulse-color": "pulse-color 2s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 1s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
