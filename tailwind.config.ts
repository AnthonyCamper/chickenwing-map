import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand "amber" remapped to HOT SAUCE — primary heat ramp.
        // Existing components reference `amber-*`; this overrides Tailwind's
        // default amber so the whole app shifts to wing-sauce red-orange.
        amber: {
          50:  '#fff3ee',
          100: '#ffded0',
          200: '#ffb59a',
          300: '#ff8762',
          400: '#fa5a2e',  // primary action
          500: '#e8361a',  // pressed / strong
          600: '#c1240d',
          700: '#971a09',
          800: '#6f1407',
          900: '#460b05',
        },

        // ── Warm paper neutrals — backgrounds, cards, surfaces
        warmgray: {
          50:  '#fbf7ee',
          100: '#f4ecd9',
          200: '#e6d8b7',
          300: '#cdb98a',
          400: '#a3895a',
          500: '#7a6240',
        },

        // ── Ink / night — text + dark surfaces, leans navy-charcoal
        charcoal: {
          100: '#e7e3d8',
          200: '#c7c1ae',
          300: '#9a937b',
          400: '#6c6650',
          500: '#3f3a2a',
          600: '#252134',  // start drifting toward night
          700: '#171527',
          800: '#0c0b1a',
          900: '#04030d',
        },

        // ── New named brand tokens ────────────────────────────────
        // Deep navy — the dominant dark canvas for hero / nav blocks
        night: {
          50:  '#eaeef8',
          100: '#c7d0e8',
          200: '#8e9dc8',
          300: '#5867a0',
          400: '#2b375f',
          500: '#1a2240',
          600: '#131938',
          700: '#0d122a',
          800: '#080a1c',
          900: '#04050e',
        },

        // Cream — the warm off-white anchor (paper)
        cream: {
          50:  '#fdfaf2',
          100: '#f8efd8',
          200: '#f0deae',
          300: '#e6c87f',
          400: '#d6ac4a',
          500: '#a6822f',
        },

        // Hot sauce red — the loudest accent (heat / spice / emergency)
        sauce: {
          50:  '#fff1ef',
          100: '#ffd6d0',
          200: '#ffa499',
          300: '#ff6e60',
          400: '#f73d2a',
          500: '#d61f0d',
          600: '#ad1607',
          700: '#831106',
          800: '#5d0c04',
          900: '#380703',
        },

        // Burnt orange — secondary heat between sauce and gold
        ember: {
          50:  '#fff5eb',
          100: '#ffe2c4',
          200: '#ffbe7a',
          300: '#fa9332',
          400: '#dd7212',
          500: '#b35707',
          600: '#8a4205',
          700: '#653104',
          800: '#462203',
          900: '#291401',
        },

        // Warm gold — celebratory, leaderboards, badges
        gold: {
          50:  '#fff9e6',
          100: '#fdedb0',
          200: '#fadc73',
          300: '#f1c12d',
          400: '#cf9b14',
          500: '#a07710',
          600: '#7a5b0e',
          700: '#5a420d',
          800: '#3d2c0a',
          900: '#221806',
        },

        // DC cherry blossom — muted regional accent
        cherry: {
          50:  '#fff3f6',
          100: '#ffd9e2',
          200: '#ffb0c3',
          300: '#fa7d9d',
          400: '#e44a73',
          500: '#b8294d',
          600: '#8c1c39',
          700: '#651328',
          800: '#430c1a',
          900: '#26060e',
        },

        // Nightlife teal/cyan — small pop highlights
        neon: {
          50:  '#e6fbff',
          100: '#b3f0fb',
          200: '#74e0f0',
          300: '#2ec4dd',
          400: '#10a0bb',
          500: '#0b7c92',
          600: '#085c6e',
          700: '#06434f',
          800: '#042c34',
          900: '#02181c',
        },
      },

      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Anton', 'Impact', 'sans-serif'],          // athletic condensed
        hand:    ['"Permanent Marker"', 'Caveat', 'cursive'], // handwritten accent
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      // Tighten the letterspacing knob for big condensed display type
      letterSpacing: {
        tightest: '-0.04em',
        crowd:    '0.18em',  // for uppercase eyebrow labels
      },

      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      // Sticker-style hard shadows for the gritty look
      boxShadow: {
        soft:     '0 2px 14px 0 rgba(8, 11, 28, 0.10)',
        card:     '0 6px 28px 0 rgba(8, 11, 28, 0.14)',
        elevated: '0 14px 52px 0 rgba(8, 11, 28, 0.22)',
        // hard offsets used on poster/sticker elements
        sticker:  '4px 4px 0 0 rgba(4, 5, 14, 0.85)',
        'sticker-sm': '2px 2px 0 0 rgba(4, 5, 14, 0.85)',
        'sticker-sauce': '4px 4px 0 0 #d61f0d',
        'sticker-gold':  '4px 4px 0 0 #cf9b14',
      },

      backgroundImage: {
        grain:    "url('/textures/grain.svg')",
        halftone: "url('/textures/halftone.svg')",
        splatter: "url('/textures/splatter.svg')",
        // diagonal caution stripe
        stripes:  'repeating-linear-gradient(45deg, #f73d2a 0 12px, #04050e 12px 24px)',
      },

      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.25s ease-out',
        'marquee':     'marquee 32s linear infinite',
        'marquee-fast':'marquee 16s linear infinite',
        'wobble':      'wobble 0.6s ease-in-out',
        'tape-in':     'tapeIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'sauce-drip':  'sauceDrip 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        wobble: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%':      { transform: 'rotate(2deg)' },
        },
        tapeIn: {
          '0%':   { opacity: '0', transform: 'rotate(-6deg) scale(0.9)' },
          '60%':  { transform: 'rotate(1.5deg) scale(1.03)' },
          '100%': { opacity: '1', transform: 'rotate(-2deg) scale(1)' },
        },
        sauceDrip: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(2px)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
