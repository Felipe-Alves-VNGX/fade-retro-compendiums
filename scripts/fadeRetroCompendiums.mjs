import { preloadHandlebarsTemplates } from './system/templates.mjs';
import { FADERETRO } from './system/config.mjs';

Hooks.once('init', async function () {
   //console.debug('FADERETRO: init hook called.');
});

Hooks.once('beforeFadeInit', async function (fadeRegistry) {
   //console.debug('FADERETRO: beforeFadeInit hook called.');
});

Hooks.once('afterFadeInit', async function (fadeRegistry) {
   //console.debug('FADERETRO: afterFadeInit hook called.');
   await preloadHandlebarsTemplates();
});

Hooks.once('beforeFadeReady', async function (fadeRegistry) {
   //console.debug('FADERETRO: beforeFadeReady hook called.');
});

Hooks.once('afterFadeReady', async function (fadeRegistry) {
   //console.debug('FADERETRO: afterFadeReady hook called.');
});
