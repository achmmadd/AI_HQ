"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  Image,
  MessageSquare,
  Receipt,
  Settings,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV = [
  {
    group: "Assistent",
    items: [
      { href: "/bokas/chat", label: "Chat", icon: MessageSquare },
      { href: "/bokas", label: "Overzicht", icon: UtensilsCrossed },
    ],
  },
  {
    group: "Werk",
    items: [
      { href: "/bokas/bonnen", label: "Boekhouding", icon: Receipt },
      { href: "/bokas/voorraad", label: "Voorraad", icon: ShoppingBag },
      { href: "/bokas/content", label: "Content", icon: Image },
      { href: "/bokas/photo-studio", label: "Studio", icon: Camera },
      { href: "/bokas/marketing", label: "Marketing", icon: TrendingUp },
      { href: "/bokas/settings/context", label: "Instellingen", icon: Settings },
    ],
  },
] as const;

function active(pathname: string, href: string) {
  if (href === "/bokas/chat") {
    return pathname === "/bokas/chat" || pathname.startsWith("/bokas/chat/");
  }
  if (href === "/bokas") {
    return pathname === "/bokas";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BokasSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sb-top">
        <div className="sb-logo">
          <Logo size="sm" />
          <div>
            <div className="sb-name">Bokas</div>
            <div className="sb-domain">Restaurant · operations</div>
          </div>
        </div>
        <Link href="/bokas/chat" className="sb-ai-hint">
          <div className="sb-ai-hint-label">✦ Bas · AI</div>
          <div className="sb-ai-hint-text">Vraag over reserveringen, menu of team…</div>
        </Link>
      </div>

      <nav className="sb-nav">
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="nav-group-label">{section.group}</div>
            {section.items.map((item) => (
              <Link
                key={`${section.group}-${item.label}`}
                href={item.href}
                className={cn("nav-link", active(pathname, item.href) && "active")}
              >
                <item.icon />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-bottom">
        <div className="sb-stats">
          <div>
            <div className="sb-stat-label">Agent</div>
            <div className="sb-stat-value">Bas</div>
            <div className="sb-stat-delta">Bokas</div>
          </div>
          <div>
            <div className="sb-stat-label">Stack</div>
            <div className="sb-stat-value" style={{ fontSize: 13 }}>
              Bokas
            </div>
            <div className="sb-stat-delta">studio</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
