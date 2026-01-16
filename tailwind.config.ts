
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
        // Accordion
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        
        // Fade animations
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" },
        },
        "fade-in-fast": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        
        // Slide animations
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        
        // Scale animations
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "scale-out": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.95)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "70%": { transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        
        // Blur animations
        "blur-in": {
          "0%": { opacity: "0", filter: "blur(8px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
        "blur-out": {
          "0%": { opacity: "1", filter: "blur(0)" },
          "100%": { opacity: "0", filter: "blur(8px)" },
        },
        
        // Float & Bounce
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "float-subtle": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        
        // Glow & Pulse
        "glow-pulse": {
          "0%, 100%": { boxShadow: "var(--shadow-soft)" },
          "50%": { boxShadow: "var(--glow-primary), var(--shadow-colored)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "pulse-color": {
          "0%, 100%": { transform: "scale(1)", filter: "brightness(1)" },
          "50%": { transform: "scale(1.05)", filter: "brightness(1.2)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "1" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
        
        // Shimmer & Loading
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "skeleton": {
          "0%": { backgroundColor: "hsl(var(--muted))" },
          "50%": { backgroundColor: "hsl(var(--muted) / 0.5)" },
          "100%": { backgroundColor: "hsl(var(--muted))" },
        },
        
        // Wiggle & Shake
        "wiggle": {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        
        // Ripple effect
        "ripple": {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
        
        // Spin variations
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        
        // Heartbeat
        "heartbeat": {
          "0%, 100%": { transform: "scale(1)" },
          "14%": { transform: "scale(1.1)" },
          "28%": { transform: "scale(1)" },
          "42%": { transform: "scale(1.1)" },
          "70%": { transform: "scale(1)" },
        },
        
        // Gradient shift
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        // Accordion
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        
        // Fade
        "fade-in": "fade-in 0.3s ease-out forwards",
        "fade-out": "fade-out 0.3s ease-out forwards",
        "fade-in-fast": "fade-in-fast 0.15s ease-out forwards",
        
        // Slide
        "slide-in": "slide-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out forwards",
        "slide-down": "slide-down 0.4s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        "slide-in-left": "slide-in-left 0.3s ease-out forwards",
        
        // Scale
        "scale-in": "scale-in 0.2s ease-out forwards",
        "scale-out": "scale-out 0.2s ease-out forwards",
        "pop-in": "pop-in 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards",
        
        // Blur
        "blur-in": "blur-in 0.4s ease-out forwards",
        "blur-out": "blur-out 0.3s ease-out forwards",
        
        // Float & Bounce
        "float": "float 3s ease-in-out infinite",
        "float-subtle": "float-subtle 2s ease-in-out infinite",
        "bounce-gentle": "bounce-gentle 1.5s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 1s ease-in-out infinite",
        
        // Glow & Pulse
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "pulse-color": "pulse-color 2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        
        // Shimmer & Loading
        "shimmer": "shimmer 2s linear infinite",
        "skeleton": "skeleton 1.5s ease-in-out infinite",
        
        // Wiggle & Shake
        "wiggle": "wiggle 0.3s ease-in-out",
        "shake": "shake 0.5s ease-in-out",
        
        // Ripple
        "ripple": "ripple 0.6s ease-out",
        
        // Spin
        "spin-slow": "spin-slow 2s linear infinite",
        "spin-slower": "spin-slow 3s linear infinite",
        
        // Heartbeat
        "heartbeat": "heartbeat 1.5s ease-in-out infinite",
        
        // Gradient
        "gradient-shift": "gradient-shift 3s ease infinite",
        
        // Combined entrance animations
        "enter": "fade-in 0.3s ease-out, scale-in 0.2s ease-out",
        "exit": "fade-out 0.3s ease-out, scale-out 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
