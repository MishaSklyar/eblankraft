// Entry for the browser build of three.js (see tools/build_three.mjs).
// The game uses classic <script> tags and a global THREE, which upstream
// stopped shipping in r160, so we bundle the ES modules into one IIFE.
import * as CORE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// A plain mutable object: vendored add-ons (Water.js, rtx_vendor.js) attach
// themselves as THREE.Foo, which a frozen module namespace would reject.
const THREE = Object.assign({}, CORE, { GLTFLoader });

// Keep the pre-r152 colour pipeline: hex colours in materials and lights are
// used as-is instead of being converted from sRGB. All the game's colour
// values were tuned under that model.
THREE.ColorManagement.enabled = false;

// UMD-style export, like the old three.min.js: CommonJS for Node (server/engine.js, tests), a global in the browser.
if (typeof module === 'object' && module.exports) module.exports = THREE;
else globalThis.THREE = THREE;
