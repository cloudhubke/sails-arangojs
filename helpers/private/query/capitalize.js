module.exports = function capitalizeFirstLetter(string) {
  const str = `${string}`;
  return str.charAt(0).toUpperCase() + string.slice(1);
};
