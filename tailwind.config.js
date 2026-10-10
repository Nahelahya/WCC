/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#173F35',
          hover: '#245747',
        },
        accent: {
          DEFAULT: '#F28C28',
        },
        bg: '#F5F6F2',
        surface: '#FFFFFF',
        ink: '#17211D',
        muted: '#66736C',
        line: '#DCE3DD',
        success: '#238653',
        warning: '#C27A13',
        danger: '#C43D3D',
        info: '#2876B8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
        control: '9px',
      },
      boxShadow: {
        soft: '0 6px 24px -8px rgba(23, 33, 29, 0.18)',
        pop: '0 12px 32px -12px rgba(23, 33, 29, 0.28)',
      },
      transitionDuration: {
        ui: '180ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
      },
    },
  },
  plugins: [],
}
