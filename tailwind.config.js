/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        skillpath: {
          ink: '#182522',
          pine: '#102A27',
          jade: '#2B8073',
          copper: '#C87941',
          saffron: '#C6A34A',
          mist: '#F4F7F5',
          paper: '#FFFFFF',
          line: '#D7E0DB',
          muted: '#66756F',
          danger: '#B94A48',
          focus: '#1D6F64'
        }
      },
      boxShadow: {
        panel: '0 18px 48px rgba(16, 42, 39, 0.12)',
        soft: '0 8px 22px rgba(24, 37, 34, 0.08)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
};
