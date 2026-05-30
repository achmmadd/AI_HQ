import { NextRequest, NextResponse } from "next/server";
import { getPublishedBySlug } from "@/lib/fumero/tools-service";
import { motorPublicOrigin } from "@/lib/fumero/public-url";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  const published = getPublishedBySlug(safe);

  if (!published || published.tool.deploy_type !== "widget") {
    return new NextResponse(`console.warn('Fumero widget niet gevonden: ${safe}');`, {
      status: 404,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const origin = motorPublicOrigin();
  const src = `${origin}/embed/fumero/preview?tool=${published.tool.id}&version=${published.version.id}`;
  const js = `(function(){
  var id='fumero-widget-${safe}';
  if(document.getElementById(id))return;
  var f=document.createElement('iframe');
  f.id=id;f.src=${JSON.stringify(src)};
  f.title='${published.tool.name.replace(/'/g, "\\'")}';
  f.style.cssText='border:0;width:100%;min-height:420px;max-width:480px;display:block';
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
