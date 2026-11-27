// Included in the installed, self-contained checker. The child runs the normal
// evaluator. Only local module paths cross its private IPC channel.
async function reportWorkflowImports() {
  const modules = await import("node:module");
  const send = url => process.send({ type: "tokensand:watch-module", url });
  if (modules.registerHooks) {
    modules.registerHooks({
      resolve(specifier, context, nextResolve) {
        try {
          const result = nextResolve(specifier, context);
          if (result.url.startsWith("file:")) send(result.url);
          return result;
        } catch (error) {
          if (error.code === "ERR_MODULE_NOT_FOUND" && error.url?.startsWith("file:")) send(error.url);
          throw error;
        }
      },
    });
    return;
  }

  // Node 20 uses loader hooks in a worker, which needs a MessagePort to
  // reach this process. Register before importing the project's first module.
  const { MessageChannel } = await import("node:worker_threads");
  const { port1, port2 } = new MessageChannel();
  port1.on("message", send).unref();
  const loader = `
    let port;
    export function initialize(data) { port = data.port; }
    export async function resolve(specifier, context, nextResolve) {
      try {
        const result = await nextResolve(specifier, context);
        if (result.url.startsWith("file:")) port.postMessage(result.url);
        return result;
      } catch (error) {
        if (error.code === "ERR_MODULE_NOT_FOUND" && error.url?.startsWith("file:")) port.postMessage(error.url);
        throw error;
      }
    }`;
  modules.register("data:text/javascript," + encodeURIComponent(loader),
    { data: { port: port2 }, transferList: [port2] });
  // CommonJS dependencies loaded through require() can bypass Node 20's ESM hooks.
  const require = modules.createRequire(import.meta.url);
  process.once("beforeExit", () => {
    for (const filename of Object.keys(require.cache)) send(pathToFileURL(filename).href);
  });
}

async function watchWorkflow(runner) {
  const { fork } = await import("node:child_process");
  const { watch, watchFile, unwatchFile } = await import("node:fs");
  const { dirname, isAbsolute, join, relative, resolve, sep } = await import("node:path");
  const root = dirname(runner);
  const adapter = resolve(root, "observe.workflow.mjs");
  const files = new Set([runner, adapter]);
  const directories = new Map();
  const polling = new Set();
  let child, pending = false, stopping = false, timer;

  function changed() {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  }
  function statChanged(after, before) {
    if (after.mtimeMs !== before.mtimeMs || after.ino !== before.ino || after.size !== before.size) changed();
  }
  function fallback(file) {
    if (polling.has(file)) return;
    polling.add(file);
    watchFile(file, { interval: 600 }, statChanged);
  }
  function ensureDirectory(dir) {
    if (directories.has(dir)) return;
    if (dir !== root) ensureDirectory(dirname(dir));
    try {
      const handle = watch(dir, (event, name) => {
        if (!name) return changed();
        const path = join(dir, name);
        if (files.has(path)) return changed();
        if (event === "rename" && directories.has(path)) {
          // A folder was replaced. Rebind its watchers on the next run.
          for (const [key, old] of directories) if (key === path || key.startsWith(path + sep)) {
            old?.close();
            directories.delete(key);
          }
          changed();
        }
      });
      directories.set(dir, handle);
      handle.on("error", () => {
        handle.close();
        directories.set(dir, null);
        for (const file of files) if (dirname(file) === dir) fallback(file);
      });
    } catch {
      directories.set(dir, null);
    }
  }
  function attach(file) {
    const dir = dirname(file);
    ensureDirectory(dir);
    if (!directories.get(dir)) fallback(file);
    else if (polling.delete(file)) unwatchFile(file, statChanged);
  }
  function keep(used) {
    const needed = new Set([root]);
    for (const file of files) {
      if (used.has(file)) {
        for (let dir = dirname(file); !needed.has(dir); dir = dirname(dir)) needed.add(dir);
      } else {
        files.delete(file);
        if (polling.delete(file)) unwatchFile(file, statChanged);
      }
    }
    for (const [dir, handle] of directories) if (!needed.has(dir)) {
      handle?.close();
      directories.delete(dir);
    }
  }

  function stopChild() {
    const active = child;
    if (!active || active.killed) return;
    active.kill();
    const force = setTimeout(() => {
      if (child === active) active.kill("SIGKILL");
    }, 1000);
    force.unref();
    active.once("close", () => clearTimeout(force));
  }
  function run() {
    if (stopping) return;
    if (child) {
      pending = true;
      stopChild();
      return;
    }
    for (const file of files) attach(file);
    const used = new Set([runner, adapter]);
    child = fork(runner, ["--report-workflow-imports", ...process.argv.slice(3)], { stdio: ["inherit","inherit","inherit","ipc"] });
    child.on("message", message => {
      if (stopping || message?.type !== "tokensand:watch-module" || typeof message.url !== "string" || !message.url.startsWith("file:")) return;
      let filename;
      try { filename = fileURLToPath(message.url); } catch { return; }
      const local = relative(root, filename);
      if (!local || isAbsolute(local) || local.split(sep).some(part => part === ".." || part === "node_modules" ||
        part === ".git" || part === ".tokensand" || part === ".env" || part.startsWith(".env."))) return;
      filename = resolve(root, local);
      used.add(filename);
      if (files.has(filename)) return;
      files.add(filename);
      attach(filename);
    });
    child.once("close", code => {
      child = undefined;
      if (stopping) return;
      if (pending) { pending = false; run(); return; }
      if (code === 0) keep(used);
      console.log((code === 0 ? "Completed" : "Failed") + " running tokensand-check.mjs. Watching for changes.");
    });
  }
  await new Promise(done => {
    function stop() {
      stopping = true;
      clearTimeout(timer);
      for (const file of polling) unwatchFile(file, statChanged);
      for (const handle of directories.values()) handle?.close();
      if (child) {
        child.once("close", done);
        stopChild();
      } else done();
    }
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    run();
  });
}
// Generated by Tokens& for trusted local tests and trusted push CI.
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (process.argv[2] === "--watch-workflow") {
    await watchWorkflow(realpathSync(process.argv[1]));
    process.exit(0);
  }
  if (process.argv[2] === "--report-workflow-imports" && process.send) {
    process.argv.splice(2, 1);
    await reportWorkflowImports();
  }
  const hookIndex = process.argv.indexOf("--npm-test-hook", 2);
  const automatic = hookIndex !== -1 && ["pretest", "posttest"].includes(process.env.npm_lifecycle_event);
  if (hookIndex !== -1) process.argv.splice(hookIndex, 1);
  if (process.env.GITHUB_ACTIONS === "true" && !["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME)) {
    console.error("Tokens& unavailable in this GitHub event: no cases evaluated. Use the isolated Tokens& PR job or the revision-bound receipt.");
    if (automatic) console.error("Continuing the application's existing npm tests.");
    process.exit(automatic ? 0 : 2);
  }
  if (!process.argv.slice(2).some(arg => arg === "--offline-workflow" || arg.startsWith("--offline-workflow="))) {
    const workflowPath = fileURLToPath(new URL("./observe.workflow.mjs", import.meta.url));
    if (!statSync(workflowPath, { throwIfNoEntry: false })?.isFile()) {
      console.error("Tokens& setup: restore observe.workflow.mjs beside tokensand-check.mjs, then rerun npm test.");
      process.exit(2);
    }
    process.argv.push("--offline-workflow", workflowPath);
  }
}
// Offline starter. Replace planCalls with your own local function returning call IDs.
import assert from "node:assert/strict";
import { appendFileSync, closeSync, mkdtempSync, openSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { inspect, isDeepStrictEqual, parseArgs } from "node:util";
import test from "node:test";
import { pathToFileURL } from "node:url";

function planCalls(calls) {
  return calls.map(call => call.id); // Bug: a redelivered call gets scheduled twice.
}

const first = { id: "call-1", tool: "reminder" };
const second = { id: "call-2", tool: "reminder" };
const cases = [
  { id: "one_call", input: { calls: [first], expected: ["call-1"] } },
  { id: "retried_call", input: { calls: [first, first], expected: ["call-1"] } },
  { id: "distinct_calls_same_tool", input: { calls: [first, second], expected: ["call-1", "call-2"] } },
];
const candidate = ({ calls }) => planCalls(calls);

// This definition also works as observe.workflow.mjs with the connected SDK.
const workflow = {
  id: "tool-call-retries", title: "Tool call retries", scope: "synthetic",
  cases, candidate,
  baseline: ({ calls }) => [...new Set(calls.map(call => call.id))],
  evaluate: ({ input, output }) => ({ planned_calls: isDeepStrictEqual(output, input.expected) }),
  checks: [{ id: "planned_calls", label: "Schedule each distinct call once" }],
  checksVersion: "1", repetitions: 3, timeoutMs: 1000,
  maxCallsPerRun: { baseline: 0, candidate: 0 }, sourceFiles: [], evaluatorSourceFiles: [],
};

export default workflow;

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  function invalidSelection(message) {
    console.error(message);
    process.exit(2);
  }
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        "offline-workflow": { type: "string", multiple: true }, case: { type: "string", multiple: true },
        "inspect-values": { type: "boolean" }, "inspect-tools": { type: "boolean" }, "require-hosted-labels": { type: "boolean" },
      },
    }));
  } catch {
    invalidSelection("Check your options. Use --offline-workflow PATH and repeat --case=ID to select cases.");
  }
  const { "offline-workflow": paths = [], case: caseIds = [], "inspect-values": inspectValues, "inspect-tools": inspectTools, "require-hosted-labels": requireHostedLabels } = values;
  if (paths.length > 1) invalidSelection("Use --offline-workflow once. Run each workflow in a separate command.");
  const [adapter] = paths;
  if (adapter === "" || caseIds.includes("")) invalidSelection("Supply a workflow path or case ID after its option.");
  if (new Set(caseIds).size !== caseIds.length) invalidSelection("A --case ID was requested more than once. List each ID once.");
  if ((inspectTools || inspectValues) && caseIds.length !== 1) {
    invalidSelection((inspectTools ? "--inspect-tools" : "--inspect-values") + " requires --case CASE_ID. Select exactly one case to inspect.");
  }
  // Only load a trusted local adapter explicitly selected by the developer.
  const selected = adapter ? (await import(pathToFileURL(adapter).href)).default : workflow;
  assert.ok(selected?.maxCallsPerRun?.candidate === 0, "Set the offline candidate provider budget to zero.");
  assert.ok(Array.isArray(selected.cases) && selected.cases.length, "Provide at least one case.");
  assert.ok(Array.isArray(selected.checks) && selected.checks.length, "Provide at least one named check.");
  const { isAbsolute, relative, resolve, sep } = await import("node:path");
  // A cached npx runner might have no bin in the app. Use the very file that
  // ran, and resolve the selected adapter against the caller's current directory.
  function commandPath(path) {
    const absolute = resolve(path);
    const local = relative(process.cwd(), absolute);
    return local && local !== ".." && !local.startsWith(".." + sep) && !isAbsolute(local) ? "." + sep + local : absolute;
  }
  function shellWord(value) {
    if (typeof value !== "string" || value.length > 2048 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)) return null;
    if (/^[A-Za-z0-9_./:@=,+-]+$/.test(value)) return value;
    if (process.platform === "win32") {
      // Avoid cmd/PowerShell expansion and embedded quotes. A Windows path may contain spaces.
      return /^[A-Za-z0-9_./:@=,+ \\-]+$/.test(value) && !value.endsWith("\\") ? '"' + value + '"' : null;
    }
    return "'" + value.replaceAll("'", "'\\''") + "'";
  }
  let replayShown = false;
  function showCaseReplay(id) {
    if (caseIds.length === 1 || replayShown || typeof id !== "string" || !id) return;
    replayShown = true;
    const script = process.argv[1];
    const args = ["node", commandPath(script)];
    if (adapter) args.push("--offline-workflow", commandPath(adapter));
    args.push("--case=" + id, "--inspect-tools");
    const words = args.map(shellWord);
    if (words.includes(null)) {
      console.log("Replay this case with its exact ID from the workflow. Its ID or file path cannot be safely printed as a shell command.");
      return;
    }
    console.log("Replay this case: " + words.join(" "));
  }
  const focused = caseIds.length > 0;
  const items = focused ? caseIds.map(id => {
    const matches = selected.cases.filter(item => item.id === id);
    if (matches.length !== 1) {
      const choices = selected.cases.map(item => item.id)
        .filter(id => typeof id === "string" && /^[A-Za-z0-9_.:/ -]{1,100}$/.test(id)).slice(0, 8);
      const label = /^[A-Za-z0-9_.:/ -]{1,100}$/.test(id) ? " " + JSON.stringify(id) : "";
      const reason = matches.length ? "The requested case ID" + label + " is duplicated. Give each case a unique ID." : "Unknown case ID" + label + ". Use an exact ID from the selected workflow.";
      invalidSelection(reason + (choices.length ? " Available IDs include " + choices.map(id => JSON.stringify(id)).join(", ") + "." : ""));
    }
    return matches[0];
  }) : selected.cases;
  const definedTrials = Object.hasOwn(selected, "repetitions") ? selected.repetitions : 1;
  if (!Number.isInteger(definedTrials) || definedTrials < 1 || definedTrials > 10) {
    invalidSelection("Set workflow repetitions to a whole number from 1 to 10.");
  }
  const trials = focused ? Math.max(3, definedTrials) : definedTrials;
  if (focused) {
    const scope = caseIds.length === 1 ? "only " + JSON.stringify(caseIds[0]) : caseIds.length + " selected cases";
    console.log(`Checking ${scope} for ${trials} trials${caseIds.length > 1 ? " each" : ""}. Run the full suite before sharing a result.`);
  }
  let valuesFile;
  if (inspectValues) {
    valuesFile = join(mkdtempSync(join(tmpdir(), "tokensand-case-")), "values.jsonl");
    closeSync(openSync(valuesFile, "wx", 0o600));
    console.log("Private case values: " + valuesFile);
  }
  function preview(value) {
    return inspect(value, { customInspect: false, getters: false, depth: 2,
      maxArrayLength: 12, maxStringLength: 256, colors: false }).slice(0, 2048);
  }
  let observedLabels = 0;
  let invalidHostedLabel = false;
  function checkLabel(kind, label) {
    observedLabels++;
    const valid = typeof label === "string" && (kind === "step"
      ? /^[a-z][a-z0-9_]{0,63}$/.test(label)
      : /^[a-z][a-z0-9_-]{0,39}$/.test(label) && !/(?:^|[^a-z0-9])(?:sk[-_]|tobs_|dai_|tvly-)/i.test(label));
    if (!valid && !invalidHostedLabel) {
      invalidHostedLabel = true;
      console.error("Hosted label warning: an executed step or tool label would be rejected. Use a fixed, non-sensitive lowercase name starting with a letter. Tools allow digits, hyphens and underscores (40 characters total). Steps allow digits and underscores (64 total). For example, ctx.tool('inventory-get', callback). Rerun with --require-hosted-labels.");
    }
    return valid;
  }
  let interrupted = false;
  test.after(() => {
    if (requireHostedLabels) {
      if (invalidHostedLabel || !observedLabels) {
        console.error(invalidHostedLabel ? "Hosted label check failed." : "No step or tool labels ran. Exercise an instrumented candidate path.");
        process.exitCode ||= 2;
      } else {
        console.log(`Hosted label syntax passed for ${observedLabels} executed candidate calls. A connected run checks the baseline and hosted scoring.`);
      }
    }
    if (!interrupted) return;
    // A callback can ignore its abort signal and leave a socket open. Allow
    // normal teardown and reporter completion first. Successful tests must
    // retain Node's normal handling of late asynchronous errors.
    setTimeout(() => {
      console.error("The interrupted workflow still has work running. Pass ctx.signal to tool requests and close open connections before retrying.");
      process.exit(1);
    }, 1000).unref();
  });
  function registerCase(item, repetition) {
    const label = trials > 1 ? `${item.id} (trial ${repetition + 1}/${trials})` : item.id;
    // The private receipt reporter groups complete trials by exact case ID.
    const name = process.env.TOKENSAND_STARTER_COUNTS
      ? JSON.stringify([item.id, repetition + 1, trials]) : label;
    test(name, { timeout: selected.timeoutMs }, async (t) => {
      const timings = inspectTools ? focusedToolTimings(repetition + 1) : null;
      const executeLocal = async (kind, label, callback) => {
        t.signal.throwIfAborted();
        const validLabel = checkLabel(kind, label);
        if (timings && kind === "tool") return timings.run(validLabel ? label : "[unnamed]", callback);
        return callback();
      };
      let attemptedFetch = false;
      const context = {
        caseId: item.id, repetition, sessionId: randomUUID(), signal: t.signal,
        step: (label, callback) => executeLocal("step", label, callback),
        tool: (label, callback) => executeLocal("tool", label, callback),
        fetch: async () => {
          attemptedFetch = true;
          throw new Error("Provider transport is disabled for this offline check.");
        },
      };
      const onAbort = () => {
        interrupted = true;
        showCaseReplay(item.id);
        timings?.show("case interrupted");
      };
      t.signal.addEventListener("abort", onAbort, { once: true });
      const started = performance.now();
      try {
        const output = await selected.candidate(structuredClone(item.input), context);
        assert.ok(!attemptedFetch, "Provider transport is disabled for this offline check.");
        if (valuesFile) {
          t.signal.throwIfAborted();
          const row = { trial: repetition + 1, actual: preview(output) };
          if (item.input != null && Object.hasOwn(item.input, "expected")) row.expected = preview(item.input.expected);
          appendFileSync(valuesFile, JSON.stringify(row) + "\n");
        }
        let scores;
        try {
          scores = await selected.evaluate({ input: structuredClone(item.input), output, variant: "candidate" });
        } catch {
          // No scorer map was returned. Each declared check remains unscored.
        }
        const failed = [], unscored = [];
        for (const check of selected.checks) {
          t.signal.throwIfAborted();
          const label = check.label || check.id;
          try {
            const score = scores && Object.hasOwn(scores, check.id) ? scores[check.id] : undefined;
            const value = typeof score === "function" ? await score() : score;
            if (value === false) failed.push(label);
            else if (value !== true) unscored.push(label);
          } catch {
            unscored.push(label);
          }
        }
        // A synchronous callback can finish before Node gets a turn to fire its timer.
        const elapsed = performance.now() - started;
        if (Number.isFinite(selected.timeoutMs) && elapsed > selected.timeoutMs) {
          failed.push(`Case took ${Math.ceil(elapsed)} ms (deadline ${selected.timeoutMs} ms)`);
        }
        if (unscored.length) {
          const reasons = failed.length ? [`Failed checks: ${failed.join(", ")}`] : [];
          reasons.push(`Unscored checks: ${unscored.join(", ")}`);
          const error = new Error(reasons.join(". "));
          error.code = "TOKENSAND_UNSCORED";
          throw error;
        }
        assert.equal(failed.length, 0, failed.join(", "));
      } catch (error) {
        showCaseReplay(item.id);
        throw error;
      } finally {
        timings?.show("case ended");
        t.signal.removeEventListener("abort", onAbort);
      }
    });
  }
  for (const item of items) {
    for (let repetition = 0; repetition < trials; repetition++) registerCase(item, repetition);
  }
}

// Only used on an explicitly inspected local replay. Keep active calls and the
// five slowest completed calls. A case timeout can fire before a tool settles.
function focusedToolTimings(trial) {
  const active = new Set();
  const completed = [];
  let total = 0;
  let shown = false;
  let firstRejection;
  return {
    async run(label, callback) {
      const call = { index: ++total, label, started: performance.now() };
      active.add(call);
      let outcome = "rejected";
      try {
        const result = await callback();
        outcome = "returned";
        return result;
      } finally {
        active.delete(call);
        const row = { ...call, outcome, ms: performance.now() - call.started };
        if (outcome === "rejected") firstRejection ??= row;
        completed.push(row);
        completed.sort((a, b) => b.ms - a.ms || a.index - b.index);
        if (completed.length > 5) completed.pop();
      }
    },
    show(end) {
      if (shown) return;
      shown = true;
      const now = performance.now();
      const rows = [];
      for (const call of active) {
        rows.push({ ...call, outcome: "still running", ms: now - call.started });
        if (rows.length === 5) break;
      }
      rows.push(...completed);
      if (firstRejection && !completed.includes(firstRejection)) rows.push(firstRejection);
      rows.sort((a, b) => a.index - b.index);
      console.log(`Local tool calls (trial ${trial}, ${end}): ${rows.length} of ${total}`);
      for (const row of rows) {
        console.log(`  #${row.index} ${row.label} — ${row.outcome}, ${Math.round(row.ms)} ms`);
      }
    },
  };
}
