/** Minimal success toast — no extra deps. Scoped to Fumero ops pages. */

const TOAST_ID = "fumero-toast-root";

function ensureRoot(): HTMLElement {
  let root = document.getElementById(TOAST_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = TOAST_ID;
    root.setAttribute("aria-live", "polite");
    root.className = "fumero-toast-root";
    document.body.appendChild(root);
  }
  return root;
}

export function showFumeroToast(message: string, variant: "success" | "error" = "success") {
  if (typeof document === "undefined") return;
  const root = ensureRoot();
  const el = document.createElement("div");
  el.className = `fumero-toast fumero-toast--${variant}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("fumero-toast--visible"));
  const remove = () => {
    el.classList.remove("fumero-toast--visible");
    window.setTimeout(() => el.remove(), 220);
  };
  window.setTimeout(remove, 2800);
}
