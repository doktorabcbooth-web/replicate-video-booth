module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./app/components/**/*.{js,ts,jsx,tsx}", "./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'brand-teal': '#29C7A1',
        'brand-teal-2': '#11DDAC',
        'brand-light': '#C6F4E9',
        'brand-light-2': '#E7FCF7',
        'brand-dark': '#0D2C54',
        'brand-neutral': '#EEF1F6',
      },
      fontFamily: {
        poppins: ["Poppins", "ui-sans-serif", "system-ui" ],
      }
    },
  },
  plugins: [],
}
