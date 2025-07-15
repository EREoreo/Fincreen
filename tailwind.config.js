/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"], // Путь к файлам, где используется Tailwind
  theme: {
    extend: {
      fontFamily: {
        comfortaa: ["Comfortaa", "cursive"], // Подключение шрифта Comfortaa
      },
    },
  },
  plugins: [], // Добавьте плагины, если нужно
};