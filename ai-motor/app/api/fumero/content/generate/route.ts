import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { generateFumeroProductImage } from "@/lib/fumero/fal-product-image";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

type TemplateRow = {
  id: number;
  klant: string;
  platform: string;
  prompt: string;
};

const IMAGE_TYPES = new Set(["product_photo", "banner"]);

const BRAND =
  "Fumero (fumero.nl) — Nederlandse premium webshop voor HHC/CBD lifestyleproducten, " +
  "volwassen doelgroep (18+). Toon: premium maar toegankelijk, helder Nederlands, geen gezondheidsclaims.";

function applyVars(prompt: string, vars: Record<string, unknown>): string {
  let out = prompt;
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(val ?? ""));
  }
  return out;
}

/** Bouwt een rijke, type-specifieke instructie zodat n8n consistente, plak-klare output levert. */
function buildTextPrompt(contentType: string, plat: string, userPrompt: string): string {
  const base = userPrompt.trim();
  switch (contentType) {
    case "social_post":
      return [
        `Schrijf één scroll-stoppende ${plat}-post voor ${BRAND}`,
        ``,
        `Onderwerp: ${base}`,
        ``,
        `Lever exact dit, plak-klaar, zonder meta-uitleg of aanhalingstekens:`,
        `1. Een korte krachtige hook (max 1 zin).`,
        `2. Een vlotte caption van 2–4 zinnen in natuurlijke Nederlandse spreektaal, passend bij ${plat}.`,
        `3. Een duidelijke call-to-action.`,
        `4. 5–8 relevante hashtags op één regel.`,
      ].join("\n");
    case "product_text":
      return [
        `Schrijf overtuigende, SEO-vriendelijke producttekst voor ${BRAND}`,
        ``,
        `Product/onderwerp: ${base}`,
        ``,
        `Lever:`,
        `- Een pakkende producttitel.`,
        `- 2 korte alinea's verkooptekst (voordelen, beleving, gebruik).`,
        `- 3–5 bullet points met kernkenmerken.`,
      ].join("\n");
    case "email_template":
      return [
        `Schrijf een e-mail voor ${BRAND}`,
        ``,
        `Doel/onderwerp: ${base}`,
        ``,
        `Lever:`,
        `- Onderwerpregel (kort, hoge open-rate).`,
        `- Preheader (1 zin).`,
        `- E-mailtekst met persoonlijke aanhef, korte body en precies 1 duidelijke CTA-knoptekst.`,
      ].join("\n");
    case "seo_article":
      return [
        `Schrijf een SEO-artikel voor ${BRAND}`,
        ``,
        `Onderwerp/keyword: ${base}`,
        ``,
        `Lever:`,
        `- SEO-titel (max 60 tekens) en meta-description (max 155 tekens).`,
        `- H1 + 3–4 H2-koppen.`,
        `- Een vlotte intro-alinea en per H2 één korte alinea.`,
      ].join("\n");
    case "voiceover_script":
      return [
        `Schrijf een professioneel voice-over script voor ${BRAND}`,
        ``,
        `Onderwerp: ${base}`,
        ``,
        `Lever:`,
        `- Geschatte spreekduur (in seconden).`,
        `- De volledige inspreektekst in natuurlijke spreektaal, opgedeeld in korte zinnen met [pauze]-aanwijzingen waar nuttig.`,
        `- Een korte suggestie voor toon en tempo.`,
        ``,
        `Let op: dit is een voorlees-/inspreektekst die de gebruiker zelf inspreekt, geen audiobestand.`,
      ].join("\n");
    default:
      return base;
  }
}

function buildVideoPrompt(plat: string, userPrompt: string): string {
  return [
    `Maak een kant-en-klaar kort-videoscript + shotlist voor ${plat} voor ${BRAND}`,
    ``,
    `Onderwerp: ${userPrompt.trim()}`,
    ``,
    `Lever in dit format (totale duur 15–30s):`,
    `HOOK (0–3s): de openingszin die de kijker vasthoudt.`,
    `SHOTLIST: genummerde shots met per shot het beeld + wat er gebeurt.`,
    `ON-SCREEN TEKST: korte caption per shot.`,
    `VOICE-OVER: de volledige inspreektekst.`,
    `CTA: afsluitende call-to-action.`,
    `CAPTION: postcaption met 5 relevante hashtags.`,
    ``,
    `Let op: dit is een script/shotlist die de gebruiker zelf opneemt, geen kant-en-klare videofile.`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  await ensureFumeroSchemaAsync();

  const body = await req.json();
  const { template_id, platform, variabelen = {}, custom_prompt } = body as {
    template_id?: number;
    platform?: string;
    variabelen?: Record<string, unknown>;
    custom_prompt?: string;
    content_type?: string;
  };
  const contentType =
    typeof body.content_type === "string" && body.content_type.trim()
      ? body.content_type.trim()
      : "social_post";

  let prompt: string | undefined =
    typeof custom_prompt === "string" && custom_prompt.trim()
      ? custom_prompt.trim()
      : undefined;

  let plat =
    typeof platform === "string" && platform.trim()
      ? platform.trim().toLowerCase()
      : "instagram";

  if (!prompt && template_id != null) {
    const template = db
      .prepare("SELECT * FROM content_templates WHERE id = ? AND klant = ?")
      .get(template_id, "fumero") as TemplateRow | undefined;
    if (!template) {
      return NextResponse.json({ error: "template not found" }, { status: 404 });
    }
    if (!platform) {
      plat = template.platform;
    }
    prompt = applyVars(
      template.prompt,
      variabelen && typeof variabelen === "object" ? variabelen : {}
    );
  }

  if (!prompt) {
    return NextResponse.json(
      { error: "custom_prompt or template_id required" },
      { status: 400 }
    );
  }

  if (contentType === "social_video") {
    const { ok, status, data, rawText } = await callFactoryN8n({
      prompt: buildVideoPrompt(plat, prompt),
      klant: "fumero",
      afdeling: "content",
      type: "content_video_script",
      platform: plat,
    });
    if (!ok) {
      return NextResponse.json(
        { error: `n8n error: ${status}`, detail: rawText.slice(0, 500) },
        { status: status >= 400 ? status : 502 }
      );
    }
    const content = extractMessage(data) || rawText.trim();
    if (!content) {
      return NextResponse.json(
        { error: "n8n gaf geen scripttekst terug." },
        { status: 502 }
      );
    }
    const result = db
      .prepare(
        `INSERT INTO content_posts (klant, platform, type, content, status, source)
         VALUES (?,?,?,?, 'draft', 'ai')`
      )
      .run("fumero", plat, contentType, content);
    return NextResponse.json({
      id: result.lastInsertRowid,
      content,
      platform: plat,
      type: contentType,
      media_kind: "script",
    });
  }

  if (IMAGE_TYPES.has(contentType)) {
    const img = await generateFumeroProductImage({
      prompt,
      contentType,
    });
    if (!img.ok) {
      return NextResponse.json({ error: img.error }, { status: 503 });
    }
    // Schone scheiding: media_url los, content = leesbare briefing (geen markdown in de tekst).
    const content = prompt;
    const result = db
      .prepare(
        `INSERT INTO content_posts (klant, platform, type, content, status, source, media_url)
         VALUES (?,?,?,?, 'draft', 'ai', ?)`
      )
      .run("fumero", plat, contentType, content, img.url);
    return NextResponse.json({
      id: result.lastInsertRowid,
      content,
      media_url: img.url,
      platform: plat,
      type: contentType,
      media_kind: "image",
    });
  }

  const { ok, status, data, rawText } = await callFactoryN8n({
    prompt: buildTextPrompt(contentType, plat, prompt),
    klant: "fumero",
    afdeling: "content",
    type: "content_generate",
    platform: plat,
    metadata: { content_type: contentType },
  });

  if (!ok) {
    return NextResponse.json(
      { error: `n8n error: ${status}`, detail: rawText.slice(0, 500) },
      { status: status >= 400 ? status : 502 }
    );
  }

  const content = extractMessage(data) || rawText.trim();
  if (!content) {
    return NextResponse.json(
      { error: "n8n gaf geen tekst terug." },
      { status: 502 }
    );
  }
  const result = db
    .prepare(
      `INSERT INTO content_posts (klant, platform, type, content, status, source)
       VALUES (?,?,?,?, 'draft', 'ai')`
    )
    .run("fumero", plat, contentType, content);

  return NextResponse.json({
    id: result.lastInsertRowid,
    content,
    platform: plat,
    type: contentType,
    media_kind: contentType === "voiceover_script" ? "script" : "text",
  });
}
