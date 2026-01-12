module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        clinic: {
          50: "#f4f9ff",
          100: "#e6f1ff",
          200: "#cfe2ff",
          400: "#7fb2ff",
          500: "#4f8fff",
          600: "#2f6fde",
        },
      },
      boxShadow: {
        soft: "0 12px 30px rgba(15, 42, 80, 0.12)",
      },
    },
  },
  plugins: [],
};
