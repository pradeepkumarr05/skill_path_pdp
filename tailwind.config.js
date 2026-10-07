/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      skillpath: { night:'#f7f8f7', cream:'#242e29', teal:'#456653', muted:'#64716a', danger:'#a13f43', line:'#dce2df' },
      sp: { surface:'#fff', panel:'#f3f5f3', border:'#dce2df', 'border-active':'#557664', ink:'#242e29', body:'#425149', muted:'#64716a', ghost:'#7c8780', accent:'#456653', 'accent-light':'#eaf1eb', 'accent-dim':'#eaf1eb', purple:'#766380', 'purple-dim':'#f1edf4', blue:'#506f8d', 'blue-dim':'#eaf0f7', success:'#55735d', danger:'#a13f43', 'danger-dim':'#faeded', warn:'#8b652d', 'warn-dim':'#f6f0e5' },
    },
    fontFamily: { sans:['"Manrope Variable"','system-ui','sans-serif'], display:['"Manrope Variable"','system-ui','sans-serif'], mono:['Consolas','monospace'] },
    borderRadius: { xs:'4px',sm:'6px',md:'8px',lg:'8px',xl:'8px','2xl':'8px' },
    keyframes: { fadeUp: { '0%': {opacity:'0',transform:'translateY(8px)'},'100%':{opacity:'1',transform:'translateY(0)'} } },
    animation: { 'fade-up':'fadeUp .3s ease both' },
  } },
  plugins: [],
};
