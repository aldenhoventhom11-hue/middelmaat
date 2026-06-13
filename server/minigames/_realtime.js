'use strict';

// Gedeelde helpers voor realtime minigames (1,2,6,7).

// Wacht tot een conditie waar is (gepolld) of tot een veiligheidsnet-timeout.
// Reageert netjes op abort via ctx.sleep.
async function waitUntil(ctx, isDone, { pollMs = 120, maxMs = 60000, onTick } = {}) {
  const start = ctx.now();
  const polled = new Promise((resolve) => {
    const stop = ctx.every(pollMs, () => {
      if (onTick) onTick(ctx.now() - start);
      if (isDone(ctx.now() - start)) {
        stop();
        resolve();
      }
    });
  });
  await Promise.race([polled, ctx.sleep(maxMs)]);
}

// Korte aftelling (3-2-1) voor realtime games.
async function countdown(ctx, kind, extra = {}) {
  for (let c = 3; c >= 1; c--) {
    ctx.publish(Object.assign({ kind, phase: 'countdown', count: c }, extra));
    await ctx.sleep(750);
    if (ctx.isAborted()) return false;
  }
  return true;
}

function secs(ms, digits = 1) {
  return (ms / 1000).toFixed(digits) + 's';
}

module.exports = { waitUntil, countdown, secs };
