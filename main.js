const WEBHOOK_URL = "https://christophertjuacatest1.app.n8n.cloud/webhook/Agent";
const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

let messages = [];
let loading = false;
let lastPending = null;
let timer = null;
let startTime = 0;
let sessionId = crypto.randomUUID();

const $messages = document.getElementById("messages");
const $typing = document.getElementById("typing");
const $elapsed = document.getElementById("elapsed");
const $errorBar = document.getElementById("errorBar");
const $errorText = document.getElementById("errorText");
const $retry = document.getElementById("retryBtn");
const $input = document.getElementById("input");
const $send = document.getElementById("sendBtn");
const $clear = document.getElementById("clearBtn");
const $newSession = document.getElementById("newSessionBtn");
const $sessionId = document.getElementById("sessionId");
const $themeRadios = document.querySelectorAll('input[name="theme"]');

$sessionId.textContent = sessionId;
setError("");

const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);
$themeRadios.forEach(radio => {
  radio.checked = radio.value === savedTheme;
  radio.addEventListener("change", () => {
    const choice = radio.value;
    localStorage.setItem("theme", choice);
    applyTheme(choice);
  });
});

function applyTheme(option) {
  let theme = option;
  if (option === "system") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
}

function render() {
  $messages.innerHTML = "";
  messages.forEach(m => {
    const row = document.createElement("div");
    row.className = "row" + (m.role === "user" ? " right" : "");
    if (m.role === "bot") {
      const av = document.createElement("div"); av.className = "avatar bot"; av.textContent = "🤖"; row.appendChild(av);
    }
    const wrap = document.createElement("div");
    const bubble = document.createElement("div");
    bubble.className = "bubble " + (m.role);
    bubble.textContent = m.message;
    const meta = document.createElement("div");
    meta.className = "meta"; meta.textContent = new Date(m.ts).toLocaleString();
    wrap.appendChild(bubble); wrap.appendChild(meta); row.appendChild(wrap);
    if (m.role === "user") {
      const av = document.createElement("div"); av.className = "avatar user"; av.textContent = "🧑"; row.appendChild(av);
    }
    $messages.appendChild(row);
  });
  $messages.scrollTop = $messages.scrollHeight;
}

async function sendMessage(text) {
  const userMsg = { role: "user", message: text, ts: new Date().toISOString() };
  messages.push(userMsg);
  render();
  lastPending = text;
  setLoading(true);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, sessionId }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const reply = normalize(data.AIResponse);
    const botMsg = { role: "bot", message: reply, ts: new Date().toISOString() };
    messages.push(botMsg);
    render();
    setError("");
  } catch (err) {
    if (err.name === "AbortError") {
      setError("Request timed out. Please retry.", true);
    } else {
      console.error(err);
      setError("Error: " + (err.message || err), true);
    }
  } finally {
    clearTimeout(timeoutId);
    setLoading(false);
  }
}

function normalize(t) {
  if (!t) return "";
  let out = t.trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) out = out.slice(1,-1);

  // Convert any HTML markup to readable text
  const tmp = document.createElement("div");
  tmp.innerHTML = out;
  tmp.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
  tmp.querySelectorAll("p").forEach(p => p.insertAdjacentText("afterend", "\n"));
  tmp.querySelectorAll("li").forEach(li => li.insertAdjacentText("beforebegin", "• "));
  out = tmp.textContent || "";

  return out
    .replace(/\r?\n/g, "\n")      // normalise newlines
    .replace(/\n{3,}/g, "\n\n")    // collapse excessive spacing
    .trim();
}

function setLoading(v) {
  loading = v;
  $send.disabled = v;
  $input.disabled = v;
  if (v) {
    $typing.hidden = false;
    startTime = Date.now();
    timer = setInterval(() => {
      const ms = Date.now() - startTime;
      const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
      const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
      $elapsed.textContent = mm + ":" + ss;
    }, 1000);
  } else {
    $typing.hidden = true;
    clearInterval(timer);
    $elapsed.textContent = "00:00";
  }
  }

  function setError(msg, canRetry=false) {
    if (!msg) {
      $errorBar.hidden = true;
      return;
    }
    $errorText.textContent = msg;
    $errorBar.hidden = false;
    $retry.style.display = canRetry ? "inline-block" : "none";
  }

// Handlers
$send.onclick = () => {
  if (loading) return;
  const t = $input.value.trim();
  if (!t) return;
  $input.value = "";
  sendMessage(t);
};
$input.onkeydown = e => { if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); $send.click(); } };
$retry.onclick = () => lastPending && sendMessage(lastPending);
$clear.onclick = () => { messages=[]; render(); setError(""); };
$newSession.onclick = () => { messages=[]; render(); sessionId = crypto.randomUUID(); $sessionId.textContent = sessionId; };
