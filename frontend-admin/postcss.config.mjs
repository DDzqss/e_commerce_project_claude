/**
 * Tailwind CSS v4 使用独立的 PostCSS 插件 @tailwindcss/postcss。
 * 无需再在 postcss 中启用 autoprefixer（Tailwind v4 已内置）。
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
