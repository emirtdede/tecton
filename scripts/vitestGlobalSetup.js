// Vitest runs under Node, but a packaging run leaves the Electron build of the
// native SQLite addon in place. Swap it back once, before any worker starts.
const { ensure } = require('./nativeBinding');

module.exports = async function setup() {
  ensure('node');
};
