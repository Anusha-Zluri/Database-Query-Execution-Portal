module.exports = {
  sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
  },

  now() {
    return new Date();
  }
};
