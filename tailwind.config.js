/**
 * Design tokens come from the Stitch "Retail Operating System" design system.
 *
 * Every token that has to change between light and dark is a CSS custom
 * property (see src/index.css): the light values live on `:root`, the dark
 * values on `.dark`. Because Tailwind compiles these to `rgb(var(…) /
 * <alpha-value>)`, opacity modifiers (`bg-surface-container-low/60`) keep
 * working in both schemes.
 */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`

/** Neutral scale: in dark mode the ramp runs the other way (50 = darkest). */
const ramp = (prefix, shades) =>
  Object.fromEntries(shades.map((n) => [n, token(`--c-${prefix}-${n}`)]))

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "surface": token("--c-surface"),
        "surface-dim": token("--c-surface-dim"),
        "surface-bright": token("--c-surface-bright"),
        "surface-container-lowest": token("--c-surface-container-lowest"),
        "surface-container-low": token("--c-surface-container-low"),
        "surface-container": token("--c-surface-container"),
        "surface-container-high": token("--c-surface-container-high"),
        "surface-container-highest": token("--c-surface-container-highest"),
        "on-surface": token("--c-on-surface"),
        "on-surface-variant": token("--c-on-surface-variant"),
        "inverse-surface": token("--c-inverse-surface"),
        "inverse-on-surface": token("--c-inverse-on-surface"),
        "outline": token("--c-outline"),
        "outline-variant": token("--c-outline-variant"),
        "surface-tint": token("--c-surface-tint"),
        "primary": token("--c-primary"),
        "on-primary": token("--c-on-primary"),
        "primary-container": token("--c-primary-container"),
        "on-primary-container": token("--c-on-primary-container"),
        "inverse-primary": token("--c-inverse-primary"),
        "secondary": token("--c-secondary"),
        "on-secondary": token("--c-on-secondary"),
        "secondary-container": token("--c-secondary-container"),
        "on-secondary-container": token("--c-on-secondary-container"),
        "tertiary": token("--c-tertiary"),
        "on-tertiary": token("--c-on-tertiary"),
        "tertiary-container": token("--c-tertiary-container"),
        "on-tertiary-container": token("--c-on-tertiary-container"),
        "error": token("--c-error"),
        "on-error": token("--c-on-error"),
        "error-container": token("--c-error-container"),
        "on-error-container": token("--c-on-error-container"),
        // "fixed" roles stay identical in both schemes on purpose: they are
        // light chips (badges, tiles) that must keep their dark text.
        "primary-fixed": "#9cf2e8",
        "primary-fixed-dim": "#80d5cb",
        "on-primary-fixed": "#00201d",
        "on-primary-fixed-variant": "#00504a",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#4edea3",
        "on-secondary-fixed": "#002113",
        "on-secondary-fixed-variant": "#005236",
        "tertiary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#ffb95f",
        "on-tertiary-fixed": "#2a1700",
        "on-tertiary-fixed-variant": "#653e00",
        "background": token("--c-background"),
        "on-background": token("--c-on-background"),
        "surface-variant": token("--c-surface-variant"),
        // Surfaces painted with `bg-white` (cards, inputs, panels).
        "white": token("--c-card"),
        // Only the shades the app actually uses are overridden; the rest of
        // each palette keeps Tailwind's defaults.
        "slate": ramp("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        "teal": ramp("teal", [50, 100, 700, 800, 900]),
        "emerald": ramp("emerald", [50, 100, 200, 600, 700, 800, 900]),
        "amber": ramp("amber", [50, 100, 200, 700, 800]),
        "red": ramp("red", [50, 100, 600, 700]),
        "rose": ramp("rose", [100, 700]),
        "blue": ramp("blue", [100, 700]),
        "indigo": ramp("indigo", [100, 700]),
},
      borderRadius: {
        "sm": "0.25rem",
        "DEFAULT": "0.5rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "1.5rem",
        "full": "9999px"
},
      fontFamily: {
        // Google Fonts "Lato" is the single family for the whole project
        // (headlines, labels, buttons, body). Bundled locally via @fontsource.
        // Lato ships 100/300/400/700/900: font-medium renders at 400,
        // font-semibold at 700, font-extrabold at 900 (browser face matching).
        sans: ['Lato', 'system-ui', 'sans-serif'],
        headline: ['Lato', 'system-ui', 'sans-serif'],
        body: ['Lato', 'system-ui', 'sans-serif'],
        // Type scale from design/DESIGN.md (Stitch "Retail Operating System")
        'display-hero': ['Lato', 'system-ui', 'sans-serif'],
        'headline-lg': ['Lato', 'system-ui', 'sans-serif'],
        'headline-md': ['Lato', 'system-ui', 'sans-serif'],
        'headline-sm': ['Lato', 'system-ui', 'sans-serif'],
        'metric-numeral': ['Lato', 'system-ui', 'sans-serif'],
        'body-lg': ['Lato', 'system-ui', 'sans-serif'],
        'body-md': ['Lato', 'system-ui', 'sans-serif'],
        'body-sm': ['Lato', 'system-ui', 'sans-serif'],
        'label-lg': ['Lato', 'system-ui', 'sans-serif'],
        'label-md': ['Lato', 'system-ui', 'sans-serif'],
        'label-sm': ['Lato', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-hero': ['40px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'metric-numeral': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        'body-md': ['14px', { lineHeight: '20px' }],
        'body-sm': ['12px', { lineHeight: '16px' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '600' }],
      },
      spacing: {
        margin: '1rem',
        'margin-tablet': '1.5rem',
        'margin-desktop': '2rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-lg': '1.25rem',
        'space-xl': '2rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        lift: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        toast: '0 20px 25px -5px rgba(15, 23, 42, 0.12)',
      },
      keyframes: {
        'fade-down': {
          '0%': { opacity: '0', transform: 'translateY(-14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'draw-line': {
          from: { 'stroke-dashoffset': '480' },
          to: { 'stroke-dashoffset': '0' },
        },
      },
      animation: {
        'fade-down': 'fade-down 0.55s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.9s ease-out 1s both',
        'draw-line': 'draw-line 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.5s both',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
      },
    },
  },
  plugins: [],
}
