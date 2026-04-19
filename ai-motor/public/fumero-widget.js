/**
 * Fumero chat widget — embed op fumero.nl
 *
 * <script src="https://<jouw-ai-motor-host>/fumero-widget.js" data-base="https://<jouw-ai-motor-host>" async></script>
 *
 * Optioneel: window.FUMERO_CHAT_BASE = 'https://...' vóór dit script.
 */
(function () {
  var script = document.currentScript;
  var base =
    (script && script.getAttribute("data-base")) ||
    window.FUMERO_CHAT_BASE ||
    "";
  if (!base) {
    console.warn("[Fumero widget] data-base of FUMERO_CHAT_BASE ontbreekt");
    return;
  }
  base = base.replace(/\/$/, "");

  var open = false;
  var iframe = null;
  var panel = null;

  function ensurePanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.setAttribute("data-fumero-chat", "panel");
    panel.style.cssText =
      "position:fixed;z-index:2147483646;right:16px;bottom:80px;width:min(420px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35);display:none;border:1px solid rgba(255,255,255,.12);background:#0a0a0b;";
    iframe = document.createElement("iframe");
    iframe.title = "Fumero chat";
    iframe.src = base + "/embed/fumero";
    iframe.style.cssText = "width:100%;height:100%;border:0;";
    iframe.setAttribute("allow", "microphone");
    panel.appendChild(iframe);
    document.body.appendChild(panel);
  }

  var btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("data-fumero-chat", "toggle");
  btn.textContent = "Chat";
  btn.style.cssText =
    "position:fixed;z-index:2147483647;right:16px;bottom:16px;padding:12px 18px;border-radius:999px;border:0;cursor:pointer;font:600 14px system-ui,sans-serif;background:#2d6a4f;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.25);";
  btn.addEventListener("click", function () {
    ensurePanel();
    open = !open;
    if (panel) panel.style.display = open ? "block" : "none";
  });
  document.body.appendChild(btn);
})();
