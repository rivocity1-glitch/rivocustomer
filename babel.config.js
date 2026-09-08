module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: ["./scripts/normalize-product-image-babel-plugin.js"],
  };
};
