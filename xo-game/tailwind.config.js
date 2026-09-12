/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0a0b10',
          card: '#12141c',
          border: '#272a3a',
          neonCyan: '#00f2fe',
          neonPink: '#ff007f',
          neonYellow: '#ffe600',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00f2fe, inset 0 0 5px #00f2fe' },
          '100%': { boxShadow: '0 0 20px #00f2fe, inset 0 0 10px #00f2fe' },
        }
      }
    },
  },
  plugins: [],
};
