/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        skillpath: {
          ink: '#151515',
          night: '#101314',
          forest: '#123D35',
          teal: '#00A884',
          citron: '#D7FF4F',
          cream: '#F7F0E6',
          paper: '#FFFCF6',
          line: '#D9CDBE',
          muted: '#6E665D',
          danger: '#BC3930',
          focus: '#007A63'
        }
      },
      boxShadow: {
        panel: '0 24px 60px rgba(16, 19, 20, 0.18)',
        soft: '0 10px 24px rgba(21, 21, 21, 0.10)'
      },
      fontFamily: {
        sans: ['Bricolage Grotesque Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        logo: ['Newsreader Variable', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
};
