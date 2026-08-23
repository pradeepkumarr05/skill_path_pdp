/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        agent: {
          bg: '#0f172a',
          canvas: '#f5f7fb',
          surface: '#ffffff',
          panel: '#eef5f6',
          border: '#cbd5e1',
          ink: '#172033',
          muted: '#64748b',
          accent: '#4f46e5',
          assessment: '#2563eb',
          reasoning: '#7c3aed',
          learnbot: '#0f766e',
          fallback: '#e11d48',
          success: '#059669',
          warning: '#d97706'
        }
      },
      boxShadow: {
        panel: '0 12px 30px rgba(15, 23, 42, 0.08)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
};
