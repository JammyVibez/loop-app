import type { Config } from "tailwindcss";
import { designTokens } from "./lib/design-tokens";

// all in fixtures is set to tailwind v3 as interims solutions
//
// Design system: every font, type size, weight, shadow, radius and brand
// color below is imported from lib/design-tokens.ts (extracted from
// linear.app's production stylesheets). Add new values there, not here.

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	screens: {
  		'xs': '475px',
  		'sm': '640px',
  		'md': '768px',
  		'lg': '1024px',
  		'xl': '1280px',
  		'2xl': '1536px',
  		'3xl': '1920px',
  	},
  	extend: {
  		/* ── Typography: Linear font pairing + type scale (design-tokens) ── */
  		fontFamily: {
  			sans: [...designTokens.typography.fontFamily.sans],
  			mono: [...designTokens.typography.fontFamily.mono],
  		},
  		fontSize: Object.fromEntries(
  			Object.entries(designTokens.typography.fontSize).map(([key, t]) => [
  				key,
  				[t.size, { lineHeight: t.lineHeight, letterSpacing: t.letterSpacing }],
  			])
  		),
  		fontWeight: {
  			medium: String(designTokens.typography.fontWeight.medium),
  			semibold: String(designTokens.typography.fontWeight.semibold),
  			bold: String(designTokens.typography.fontWeight.bold),
  		},
  		/* ── Elevation: Linear shadow scale (theme-aware via CSS vars) ── */
  		boxShadow: {
  			tiny: 'var(--shadow-tiny)',
  			low: 'var(--shadow-low)',
  			medium: 'var(--shadow-medium)',
  			high: 'var(--shadow-high)',
  			stack: 'var(--shadow-stack)',
  		},
  		colors: {
  			/* ── Brand + signal palette (theme-independent, from design-tokens) ── */
  			brand: {
  				DEFAULT: designTokens.palette.brand,
  				light: designTokens.palette.brandLight,
  				link: designTokens.palette.brandLink,
  				accent: designTokens.palette.accent,
  				'accent-hover': designTokens.palette.accentHover,
  			},
  			signal: {
  				blue: designTokens.palette.blue,
  				green: designTokens.palette.green,
  				yellow: designTokens.palette.yellow,
  				orange: designTokens.palette.orange,
  				red: designTokens.palette.red,
  				teal: designTokens.palette.teal,
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
