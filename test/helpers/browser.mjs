// K21: the first CI run of PR #130 hung around logo.test.mjs until the 15-minute job cap
// (K7) killed it, while the suite passed locally. A stuck Playwright wait (waitForFunction,
// goto, evaluate) never resolves, so an ordinary `try { ... } finally { await browser.close() }`
// never reaches its finally either — the awaited call inside try just sits forever and the
// browser process stays open, keeping the job alive. Both helpers below race the real work
// against a hard deadline so a stuck browser test fails fast instead of eating the whole job.

// withBrowser: launches its own browser, races the caller's work against `timeout`, and closes
// the browser in `finally` either way. Closing interrupts any pending protocol call, so even a
// hung `waitForFunction` unwinds once the browser is gone and the process can exit clean.
export async function withBrowser(browserType, fn, {timeout = 30000} = {}) {
  const browser = await browserType.launch();
  let timer;
  try {
    return await Promise.race([
      fn(browser),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`withBrowser: timed out after ${timeout}ms`)), timeout); }),
    ]);
  } finally {
    clearTimeout(timer);
    await browser.close().catch(() => {});
  }
}

// raceOrExit: for a call into code this test file does not own (e.g. bin/verify.mjs), which
// launches and closes its own browser(s) internally. There is no handle to force-close from
// out here, so on a genuine timeout the whole process exits — node --test runs each test file
// as its own child process, so this only ever ends the process this file owns, never a sibling
// test file or the rest of the CI job. A real (non-timeout) rejection is left to fail normally.
export async function raceOrExit(promise, timeout, label) {
  let timer, timedOut = false;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error(`${label}: timed out after ${timeout}ms`)); }, timeout); }),
    ]);
  } catch (e) {
    if (timedOut) { console.error(`${label}: forcing process exit after a hang — ${e.message}`); process.exitCode = 1; process.exit(1); }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
