export type FumeroToolTemplateId =
  | "chat"
  | "quiz"
  | "age"
  | "bundle"
  | "review"
  | "loyalty"
  | "calculator"
  | "form"
  | "landing"
  | "dashboard"
  | "staff_app"
  | "receipt_scanner"
  | "order_tracker"
  | "kb_chat";

export type FumeroDeployType = "widget" | "internal" | "customer";

export type FumeroToolTemplate = {
  id: FumeroToolTemplateId;
  title: string;
  description: string;
  defaultDeployType: FumeroDeployType;
  promptSeed: string;
};

export const FUMERO_TOOL_TEMPLATES: FumeroToolTemplate[] = [
  {
    id: "chat",
    title: "Chatbot",
    description: "Embedded assistent op productpagina's",
    defaultDeployType: "widget",
    promptSeed:
      "Compacte chat-widget voor productvragen, professionele toon, Fumero branding subtiel.",
  },
  {
    id: "landing",
    title: "Landingspagina",
    description: "Hero, voordelen en conversie-CTA",
    defaultDeployType: "widget",
    promptSeed:
      "Single-page landingspagina: hero met headline, 3 voordelen, social proof, primaire CTA-knop, contact/footer. Responsive, premium B2B-stijl.",
  },
  {
    id: "form",
    title: "Formulier",
    description: "Bestel-, contact- of intakeformulier",
    defaultDeployType: "widget",
    promptSeed:
      "Werkend formulier met labels, validatie, duidelijke verzendknop en bedankmelding. Geen backend — toon succes-state in de pagina.",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "KPI-tegels en overzichtstabel",
    defaultDeployType: "internal",
    promptSeed:
      "Compact dashboard: 3-4 KPI-tegels bovenaan, filterbalk, sorteerbare tabel met voorbeelddata. Rustig premium design.",
  },
  {
    id: "quiz",
    title: "Keuzehulp",
    description: "Productadvies op basis van voorkeuren",
    defaultDeployType: "widget",
    promptSeed: "Interactieve keuzehulp met 3-5 stappen en duidelijke CTA naar product.",
  },
  {
    id: "age",
    title: "Leeftijdscheck",
    description: "18+ gate voor regulated content",
    defaultDeployType: "widget",
    promptSeed: "Leeftijdsverificatie gate, NL copy, geen opslag van persoonsgegevens.",
  },
  {
    id: "bundle",
    title: "Bundle builder",
    description: "Stel productbundels samen",
    defaultDeployType: "widget",
    promptSeed: "Bundle configurator met totaalprijs en toevoegen aan winkelwagen CTA.",
  },
  {
    id: "review",
    title: "Review collector",
    description: "Verzamel productreviews",
    defaultDeployType: "widget",
    promptSeed: "Review formulier na aankoop, sterren + korte tekst, GDPR-vriendelijk.",
  },
  {
    id: "loyalty",
    title: "Loyalty dashboard",
    description: "Klant loyaliteitspunten",
    defaultDeployType: "customer",
    promptSeed:
      "Loyalty dashboard voor klanten: punten, tier, beloningen, rustig premium design.",
  },
  {
    id: "calculator",
    title: "Rekenmachine",
    description: "Functionele calculator-widget",
    defaultDeployType: "widget",
    promptSeed:
      "Functionele rekenmachine (geen keuzehulp/quiz): groot display bovenaan, toetsenbord in CSS display:grid met grid-template-columns: repeat(4, 1fr); gap: 8px — 4 kolommen, knoppen NIET verticaal gestapeld. Knoppen 0-9, +, −, ×, ÷, =, C en decimaal. Achtergrond #141414 (niet puur zwart), display #1e1e1e, groene accenten #69C400 op = en primaire acties, subtiele borders rgba(255,255,255,0.08). Geist/system-ui, ruime padding (24px), grote typografie op display (32px+). Vanilla JS voor berekeningen.",
  },
  {
    id: "staff_app",
    title: "Personeelsapp",
    description: "Interne Bokas/Fumero medewerkerstool",
    defaultDeployType: "internal",
    promptSeed:
      "Interne personeelsapp: shifts, taken, snelle links. Alleen voor ingelogde medewerkers.",
  },
  {
    id: "receipt_scanner",
    title: "Bon scanner",
    description: "Scan en registreer bonnen (intern)",
    defaultDeployType: "internal",
    promptSeed: "Bon upload UI met status en categorie — intern gebruik.",
  },
  {
    id: "order_tracker",
    title: "Bestelstatus tracker",
    description: "Klant volgt bestelling",
    defaultDeployType: "customer",
    promptSeed: "Bestelstatus tracker: ordernummer invoer, timeline, support link.",
  },
  {
    id: "kb_chat",
    title: "Kennisbank chatbot",
    description: "FAQ + AI antwoorden",
    defaultDeployType: "widget",
    promptSeed: "Kennisbank chatbot met FAQ-suggesties en korte antwoorden.",
  },
];

export function getTemplate(id: string): FumeroToolTemplate | undefined {
  return FUMERO_TOOL_TEMPLATES.find((t) => t.id === id);
}

export function deployTypeLabel(t: FumeroDeployType): string {
  if (t === "widget") return "Website widget";
  if (t === "internal") return "Interne app";
  return "Klantpagina";
}

/** Snelle client-side preview tijdens bouwen (vóór deploy / LLM-generatie). */
export function buildTemplatePreviewHtml(opts: {
  templateId?: string | null;
  name: string;
  prompt: string;
  deployType: FumeroDeployType;
}): string {
  const tpl = opts.templateId ? getTemplate(opts.templateId) : undefined;
  const title = opts.name.trim() || tpl?.title || "Concept preview";
  const body = opts.prompt.trim() || tpl?.promptSeed || "Beschrijf je tool…";
  const typeLabel = deployTypeLabel(opts.deployType);
  const escaped = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  if (opts.templateId === "landing") {
    return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#171717;line-height:1.5}
  .hero{padding:48px 24px;text-align:center;background:#fff;border-bottom:1px solid #e5e5e5}
  .hero h1{font-size:clamp(1.75rem,4vw,2.5rem);font-weight:600;margin-bottom:12px}
  .hero p{max-width:520px;margin:0 auto 24px;color:#525252;font-size:15px}
  .cta{display:inline-block;padding:12px 28px;border:none;border-radius:10px;background:#69C400;color:#0a0a0a;font-weight:600;font-size:15px;cursor:pointer}
  .cta:hover{background:#5db000}
  .grid{max-width:960px;margin:0 auto;padding:40px 24px;display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
  .card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:20px}
  .card h2{font-size:16px;margin-bottom:8px}
  .card p{font-size:13px;color:#525252}
  footer{text-align:center;padding:24px;font-size:12px;color:#737373;border-top:1px solid #e5e5e5}
</style>
</head>
<body>
<section class="hero">
  <h1>${escaped(title)}</h1>
  <p>${escaped(body.slice(0, 180))}</p>
  <button class="cta" type="button" id="cta">Neem contact op</button>
</section>
<section class="grid">
  <article class="card"><h2>Snel geleverd</h2><p>Bestel voor 17:00 — volgende werkdag onderweg.</p></article>
  <article class="card"><h2>Premium kwaliteit</h2><p>Professioneel assortiment voor B2B.</p></article>
  <article class="card"><h2>Persoonlijk advies</h2><p>Ons team helpt je de juiste keuze te maken.</p></article>
</section>
<footer>© Fumero · ${escaped(typeLabel)}</footer>
<script>
(function(){
  var btn=document.getElementById('cta');
  if(btn) btn.addEventListener('click',function(){
    btn.textContent='Bedankt — we nemen contact op!';
    btn.disabled=true;
  });
})();
</script>
</body>
</html>`;
  }

  if (opts.templateId === "calculator") {
    return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#141414;color:#f5f5f5}
  .calc{width:min(100%,320px);padding:24px;border-radius:16px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);box-shadow:0 16px 48px rgba(0,0,0,0.35)}
  .display{margin-bottom:16px;padding:16px 20px;border-radius:12px;background:#1e1e1e;border:1px solid rgba(255,255,255,0.08);text-align:right;font-size:36px;font-weight:300;letter-spacing:0.02em;color:#fafafa;min-height:64px;line-height:1.2}
  .keys{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .key{height:52px;border:none;border-radius:10px;font-size:18px;font-weight:500;cursor:pointer;background:#2a2a2a;color:#e5e5e5;transition:background 0.12s ease}
  .key:hover{background:#333}
  .key.op{background:#252525;color:#a3a3a3}
  .key.eq{background:#69C400;color:#0a0a0a;font-weight:600}
  .key.eq:hover{background:#5db000}
  .meta{margin-top:16px;font-size:11px;color:#737373;text-align:center}
</style>
</head>
<body>
<div class="calc">
  <div class="display">0</div>
  <div class="keys">
    <button class="key op" type="button">C</button>
    <button class="key op" type="button">±</button>
    <button class="key op" type="button">%</button>
    <button class="key op" type="button">÷</button>
    <button class="key" type="button">7</button>
    <button class="key" type="button">8</button>
    <button class="key" type="button">9</button>
    <button class="key op" type="button">×</button>
    <button class="key" type="button">4</button>
    <button class="key" type="button">5</button>
    <button class="key" type="button">6</button>
    <button class="key op" type="button">−</button>
    <button class="key" type="button">1</button>
    <button class="key" type="button">2</button>
    <button class="key" type="button">3</button>
    <button class="key op" type="button">+</button>
    <button class="key" type="button" style="grid-column:span 2">0</button>
    <button class="key" type="button">.</button>
    <button class="key eq" type="button">=</button>
  </div>
  <p class="meta">${escaped(title)} · ${escaped(typeLabel)}</p>
</div>
<script>
(function(){
  var display=document.querySelector('.display');
  var cur='0',prev=null,op=null,fresh=true;
  function render(v){display.textContent=String(v);}
  function compute(){
    var a=prev,b=parseFloat(cur),r=0;
    if(op==='+')r=a+b;else if(op==='−')r=a-b;else if(op==='×')r=a*b;else if(op==='÷')r=b?a/b:0;
    cur=String(Math.round(r*1e10)/1e10);render(cur);
  }
  function input(val){
    if(val==='C'){cur='0';prev=null;op=null;fresh=true;render(cur);return;}
    if(val==='±'){cur=String(parseFloat(cur||'0')*-1);render(cur);return;}
    if(/^[0-9.]$/.test(val)){
      if(fresh||cur==='0')cur=val;else cur+=val;
      fresh=false;render(cur);return;
    }
    if(['+','−','×','÷'].indexOf(val)>=0){
      if(op!==null&&prev!==null)compute();
      prev=parseFloat(cur);op=val;fresh=true;return;
    }
    if(val==='='){if(op!==null&&prev!==null)compute();op=null;prev=null;fresh=true;}
  }
  document.querySelectorAll('.key').forEach(function(btn){
    btn.addEventListener('click',function(){input((btn.textContent||'').trim());});
  });
})();
</script>
</body>
</html>`;
  }

  if (opts.templateId === "chat" || opts.templateId === "kb_chat") {
    return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#171717;padding:16px}
  .chat{max-width:360px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06)}
  .head{padding:12px 14px;border-bottom:1px solid #e5e5e5;font-size:14px;font-weight:600}
  .msgs{padding:12px;display:flex;flex-direction:column;gap:8px;min-height:160px;max-height:240px;overflow-y:auto}
  .msg{max-width:85%;padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.45}
  .bot{background:#f5f5f5;color:#171717;align-self:flex-start}
  .user{background:#69C400;color:#0a0a0a;align-self:flex-end}
  .bar{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e5e5}
  .bar input{flex:1;border:1px solid #e5e5e5;border-radius:8px;padding:8px 10px;font-size:13px;outline:none}
  .bar button{border:none;border-radius:8px;background:#69C400;color:#0a0a0a;font-weight:600;padding:8px 14px;cursor:pointer;font-size:13px}
  .bar button:hover{background:#5db000}
</style>
</head>
<body>
<div class="chat">
  <div class="head">${escaped(title)}</div>
  <div class="msgs" id="msgs">
    <div class="msg bot">Hoi! Waarmee kan ik je helpen?</div>
  </div>
  <div class="bar">
    <input id="inp" type="text" placeholder="Stel je vraag…" autocomplete="off"/>
    <button type="button" id="send">Verstuur</button>
  </div>
</div>
<script>
(function(){
  var msgs=document.getElementById('msgs');
  var inp=document.getElementById('inp');
  var send=document.getElementById('send');
  function add(text,who){
    var el=document.createElement('div');
    el.className='msg '+(who==='user'?'user':'bot');
    el.textContent=text;
    msgs.appendChild(el);
    msgs.scrollTop=msgs.scrollHeight;
  }
  function reply(q){
    var lower=q.toLowerCase();
    if(/prijs|kosten/.test(lower)) return 'Onze prijzen staan op fumero.nl — wil je een specifiek product?';
    if(/lever|verzend/.test(lower)) return 'Bestellingen worden binnen 1-2 werkdagen verzonden.';
    return 'Bedankt voor je vraag! Een medewerker helpt je graag verder via fumero.nl/contact.';
  }
  function submit(){
    var t=(inp.value||'').trim();
    if(!t)return;
    add(t,'user');
    inp.value='';
    window.setTimeout(function(){add(reply(t),'bot');},400);
  }
  send.addEventListener('click',submit);
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')submit();});
})();
</script>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#171717}
  .wrap{max-width:420px;margin:0 auto;padding:20px}
  .badge{display:inline-block;font-size:11px;font-weight:600;color:#525252;background:#fff;border:1px solid #e5e5e5;border-radius:6px;padding:4px 8px;margin-bottom:12px}
  h1{font-size:18px;font-weight:600;margin:0 0 8px}
  p{font-size:13px;line-height:1.5;color:#525252;margin:0 0 16px;white-space:pre-wrap}
  .mock{border:1px dashed #d4d4d4;border-radius:8px;background:#fff;padding:16px;min-height:120px}
  .mock-label{font-size:11px;color:#a3a3a3;margin-bottom:8px}
</style>
</head>
<body>
<div class="wrap">
  <span class="badge">${escaped(typeLabel)} · Concept</span>
  <h1>${escaped(title)}</h1>
  <p>${escaped(body)}</p>
  <div class="mock">
    <div class="mock-label">Live preview — wordt gegenereerd bij &quot;Concept aanmaken&quot;</div>
    ${tpl ? `<strong style="font-size:13px">${escaped(tpl.title)}</strong>` : ""}
  </div>
</div>
</body>
</html>`;
}

/** Data-URL voor directe iframe-preview (zelfde sandbox als embed). */
export function templatePreviewDataUrl(opts: {
  templateId?: string | null;
  name: string;
  prompt: string;
  deployType: FumeroDeployType;
}): string {
  const html = buildTemplatePreviewHtml(opts);
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
