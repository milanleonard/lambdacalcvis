import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"], // Enforce class-based dark mode
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
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
  			sidebar: { // Kept for completeness, though not used in this app
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
        // Custom AST node colors
        'ast-variable-bg': 'hsl(var(--ast-variable-bg))',
        'ast-variable-fg': 'hsl(var(--ast-variable-fg))',
        'ast-lambda-bg': 'hsl(var(--ast-lambda-bg))',
        'ast-lambda-fg': 'hsl(var(--ast-lambda-fg))',
        'ast-application-bg': 'hsl(var(--ast-application-bg))',
        'ast-application-fg': 'hsl(var(--ast-application-fg))',
        'ast-highlight-bg': 'hsl(var(--ast-highlight-bg))',
        'ast-highlight-fg': 'hsl(var(--ast-highlight-fg))',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
        sans: ['var(--font-geist-sans)', 'var(--font-inter)'],
        mono: ['var(--font-geist-mono)', 'monospace'],
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
  			},
        'fadeIn': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'highlightPulse': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--ast-highlight-bg) / 0.7)' },
          '70%': { boxShadow: '0 0 0 10px hsl(var(--ast-highlight-bg) / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(var(--ast-highlight-bg) / 0)' },
        }
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
        'fadeIn': 'fadeIn 0.3s ease-out',
        'highlightPulse': 'highlightPulse 1s ease-out',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
