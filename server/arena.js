'use strict';

// The arena authority lives in js/arena_core.js so the browser can run the same code offline
// (Dust2 1v1 against a bot, see js/local_arena.js). The server keeps importing it from here.
module.exports = require('../js/arena_core.js');
