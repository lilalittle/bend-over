import { runDemo } from "./demo.js";
import { createBrowserHost, STORAGE_KEY } from "./host.js";

const $ = (id) => document.getElementById(id);
const form = $("signal-form");
const surface = $("signal-surface");
const trace = $("trace-list");
let running = false;
let sources = {};
let activeFile = "main.bend";

function showSaved(value) {
  $("saved-message").textContent = value === null ? "Nothing saved yet." : value;
  $("clear-saved").disabled = value === null;
}
try { showSaved(localStorage.getItem(STORAGE_KEY)); }
catch { $("saved-message").textContent = "Storage is unavailable in this browser."; }

$("clear-saved").addEventListener("click", () => {
  try { localStorage.removeItem(STORAGE_KEY); showSaved(null); }
  catch { $("run-status").textContent = "Could not clear browser storage."; }
});

$("delay").addEventListener("input", () => { $("delay-value").textContent = `${$("delay").value} ms`; });

function resetTrace() {
  trace.replaceChildren();
  $("trace-empty").hidden = false;
  $("trace-count").textContent = "0 / 7";
  $("run-error").hidden = true;
  $("clear-trace").disabled = true;
}
$("clear-trace").addEventListener("click", () => { resetTrace(); $("run-status").textContent = "Ready when you are."; });

function format(value) {
  if (value?.$ === "Unit") return "Unit";
  return JSON.stringify(value);
}

function onEffect(event) {
  if (event.phase === "start") {
    $("trace-empty").hidden = true;
    const row = document.createElement("li");
    row.className = "trace-item";
    row.dataset.index = String(event.index);
    row.dataset.state = "running";
    for (const [className, text] of [
      ["trace-index", String(event.index).padStart(2, "0")],
      ["trace-name", event.name],
      ["trace-data", `(${event.args.map(format).join(", ")}) → waiting`],
      ["trace-time", "…"],
      ["trace-state", "◌"],
    ]) {
      const node = document.createElement("span");
      node.className = className;
      node.textContent = text;
      row.append(node);
    }
    trace.append(row);
    $("run-status").textContent = `${event.name}…`;
  } else {
    const row = trace.querySelector(`[data-index="${event.index}"]`);
    row.dataset.state = event.phase;
    row.querySelector(".trace-data").textContent = event.phase === "error"
      ? event.error : `(${event.args.map(format).join(", ")}) → ${format(event.value)}`;
    row.querySelector(".trace-time").textContent = `${event.duration.toFixed(1)} ms`;
    row.querySelector(".trace-state").textContent = event.phase === "error" ? "×" : "✓";
    row.querySelector(".trace-state").setAttribute("aria-label", event.phase === "error" ? "Failed" : "Complete");
    $("trace-count").textContent = `${event.index - (event.phase === "error" ? 1 : 0)} / 7`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (running) return;
  const message = $("message").value.trim();
  if (!message) {
    $("message").setCustomValidity("Write a message to send a signal.");
    $("message").reportValidity();
    return;
  }
  const configuration = new FormData(form);
  running = true;
  resetTrace();
  for (const control of form.elements) control.disabled = true;
  $("run").innerHTML = '<span aria-hidden="true">◌</span> Running… <kbd>↵</kbd>';
  $("clear-saved").disabled = true;
  surface.dataset.state = "running";
  $("surface-state").textContent = "Signal in progress";
  $("surface-coordinate").textContent = "IO(Unit)";
  const start = performance.now();
  let completion = "";
  let didSave = false;
  try {
    await runDemo(createBrowserHost({
      message,
      tone: configuration.get("tone"),
      delay: Number(configuration.get("delay")),
      failNetwork: configuration.has("fail-network"),
      paint: (text, hue) => {
        surface.style.setProperty("--signal-hue", hue);
        $("signal-message").textContent = text;
        $("signal-label").textContent = "A MESSAGE FROM BEND";
      },
      saved: (text) => { didSave = true; showSaved(text); },
      finish: (text) => { completion = text; },
    }), { onEffect });
    surface.dataset.state = "complete";
    $("surface-state").textContent = "Signal delivered";
    $("signal-label").textContent = "EFFECTS COMPLETE";
    $("run-status").textContent = `7 effects completed · ${Math.round(performance.now() - start)} ms`;
    $("surface-coordinate").textContent = "7 / 7";
    if (!didSave) {
      $("run-error").hidden = false;
      $("run-error").textContent = completion;
    }
  } catch (error) {
    surface.dataset.state = "error";
    $("surface-state").textContent = "Signal stopped";
    $("signal-label").textContent = "LAST DOM OUTPUT";
    $("surface-coordinate").textContent = $("trace-count").textContent;
    $("run-status").textContent = "Stopped at a failed effect.";
    $("run-error").hidden = false;
    $("run-error").textContent = `${error.message} ${configuration.has("fail-network") ? "Turn off “Simulate a failed fetch” and run again." : "Check the connection and run again."}`;
  } finally {
    running = false;
    for (const control of form.elements) control.disabled = false;
    $("run").innerHTML = '<span aria-hidden="true">▶</span> Run effects <kbd>↵</kbd>';
    $("clear-trace").disabled = false;
    try { showSaved(localStorage.getItem(STORAGE_KEY)); } catch { $("clear-saved").disabled = true; }
  }
});
$("message").addEventListener("input", () => $("message").setCustomValidity(""));

const descriptions = {
  "main.bend": "Bend sequences the effects and handles the result.",
  "web.bend": "Typed IO declarations connect Bend to JavaScript.",
  "effects.js": "Registered handlers translate values across the boundary.",
  "host.js": "Real browser APIs: fetch, DOM, timers, and localStorage.",
};

function highlight(line, language) {
  const fragment = document.createDocumentFragment();
  const pattern = language === "bend"
    ? /(#.*$|"(?:\\.|[^"\\])*"|\b(?:import|def|do|match|case)\b|\b(?:String|U32|Unit|Bool|IO|True|False)\b|\bWeb\.\w+)/g
    : /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:export|function|const|let|return|async|await|if|throw|new|try|catch)\b|\b(?:io_eff|CID|browserHost)\b)/g;
  let position = 0;
  for (const match of line.matchAll(pattern)) {
    fragment.append(document.createTextNode(line.slice(position, match.index)));
    const span = document.createElement("span");
    const value = match[0];
    span.className = value.startsWith("#") || value.startsWith("//") ? "token-comment"
      : /^['"]/.test(value) ? "token-string"
      : /^(Web\.|io_eff|CID|browserHost)/.test(value) ? "token-function"
      : /^(String|U32|Unit|Bool|IO|True|False)$/.test(value) ? "token-type" : "token-keyword";
    span.textContent = value;
    fragment.append(span);
    position = match.index + value.length;
  }
  fragment.append(document.createTextNode(line.slice(position)));
  return fragment;
}

function selectSource(tab) {
  activeFile = tab.dataset.file;
  for (const item of document.querySelectorAll('[role="tab"]')) {
    item.setAttribute("aria-selected", String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  }
  $("source-view").setAttribute("aria-labelledby", tab.id);
  $("source-code").replaceChildren();
  const source = sources[activeFile];
  if (!source) { $("source-code").textContent = "Source is unavailable. Reload to try again."; return; }
  source.trimEnd().split("\n").forEach((line, index) => {
    const row = document.createElement("code");
    row.className = "source-line";
    const number = document.createElement("span");
    number.className = "line-number";
    number.textContent = String(index + 1);
    number.setAttribute("aria-hidden", "true");
    row.append(number, highlight(line, activeFile.endsWith(".bend") ? "bend" : "js"));
    $("source-code").append(row);
  });
  $("source-description").textContent = descriptions[activeFile];
  $("source-view").scrollTo(0, 0);
}

const tabs = [...document.querySelectorAll('[role="tab"]')];
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectSource(tab));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    tabs[next].focus();
    selectSource(tabs[next]);
  });
});

$("copy-source").addEventListener("click", async () => {
  if (!sources[activeFile]) return;
  try {
    await navigator.clipboard.writeText(sources[activeFile]);
    $("copy-source").textContent = "Copied";
  } catch { $("copy-source").textContent = "Select to copy"; }
  setTimeout(() => { $("copy-source").textContent = "Copy source"; }, 1800);
});

try {
  const response = await fetch("./sources.json");
  if (!response.ok) throw new Error("Source request failed.");
  sources = await response.json();
  selectSource(tabs[0]);
} catch {
  $("source-code").textContent = "Could not load source. Reload to try again.";
  $("copy-source").disabled = true;
}

document.querySelectorAll(".mobile-nav a").forEach(link => {
  link.addEventListener("click", () => { document.querySelector(".mobile-nav").open = false; });
});
