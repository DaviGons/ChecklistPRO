/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#09090b', // zinc-950
        card: '#18181b', // zinc-900
        border: '#27272a', // zinc-800
        green: {
          500: '#22c55e',
        },
        yellow: {
          500: '#eab308',
        },
        red: {
          500: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
