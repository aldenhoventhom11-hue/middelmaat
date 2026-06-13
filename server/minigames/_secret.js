'use strict';

// Gedeelde runner voor "geheime-invoer" minigames (3,4,5,8,9,10).
// Vaste rondetijd; wie niet op tijd inlevert krijgt geen uitkomst en valt zo
// terug op de slechtst mogelijke (extreme) waarde die de engine invult.
//
// De server is autoritair: late en dubbele inzendingen worden genegeerd, en
// elke waarde wordt server-side gevalideerd.
async function runSecret(ctx, opts) {
  const {
    kind,
    duration = 30000,
    config = {},
    validate,
    compute,
  } = opts;

  const submissions = {}; // pid -> genormaliseerde inzending
  const deadline = ctx.now() + duration;

  ctx.publish(
    Object.assign(
      {
        kind,
        type: 'secret',
        deadline,
        total: ctx.ids.length,
        submitted: [],
      },
      config
    )
  );

  let resolveEarly;
  const earlyDone = new Promise((res) => {
    resolveEarly = res;
  });

  const off = ctx.onEvent((pid, payload) => {
    if (!ctx.ids.includes(pid)) return; // alleen actieve spelers
    if (pid in submissions) return; // negeer dubbele inzending
    if (!payload || payload.type !== 'submit') return;
    const norm = validate(payload.value, pid, ctx);
    if (norm === null || norm === undefined) return; // ongeldig -> negeren
    submissions[pid] = norm;
    ctx.patch({ submitted: Object.keys(submissions) });
    if (Object.keys(submissions).length >= ctx.ids.length) resolveEarly();
  });

  await Promise.race([ctx.sleep(duration), earlyDone, ctx.force]);
  off();
  if (ctx.isAborted()) return { outcomes: {} };

  return compute(submissions, ctx);
}

module.exports = { runSecret };
