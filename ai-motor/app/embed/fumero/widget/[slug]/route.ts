import { NextRequest, NextResponse } from "next/server";
import { getPublishedBySlug } from "@/lib/fumero/tools-service";
import { motorPublicOrigin } from "@/lib/fumero/public-url";

export const runtime = "nodejs";

/**
 * Publiek widget-loaderscript (type 1). Injecteert een iframe dat de kale,
 * gepubliceerde tool-HTML toont. Onder /embed/* zodat het zonder login
 * laadbaar is op fumero.nl (de /api/* variant wordt door middleware geblokkeerd).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  const published = getPublishedBySlug(safe);

  if (!published || published.tool.deploy_type !== "widget") {
    return new NextResponse(
      `console.warn('Fumero widget niet gevonden of niet gepubliceerd: ${safe}');`,
      {
        status: 404,
        headers: { "Content-Type": "application/javascript; charset=utf-8" },
      }
    );
  }

  const origin = motorPublicOrigin();
  const src = `${origin}/embed/fumero/view/${safe}`;
  const js = `(function(){
  var id='fumero-widget-${safe}';
  if(document.getElementById(id))return;
  var f=document.createElement('iframe');
  f.id=id;f.src=${JSON.stringify(src)};
  f.title=${JSON.stringify(published.tool.name)};
  f.style.cssText='border:0;width:100%;min-height:480px;max-width:520px;display:block';
  f.setAttribute('loading','lazy');
  var s=document.currentScript;
  if(s&&s.parentNode)s.parentNode.insertBefore(f,s);
  else document.body.appendChild(f);
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
}
