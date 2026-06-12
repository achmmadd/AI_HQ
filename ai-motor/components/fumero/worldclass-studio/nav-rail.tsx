"use client";
import Link from "next/link";
import {
  Bell,
  HelpCircle,
  Image,
  LayoutGrid,
  Palette,
  User,
} from "lucide-react";
export type StudioView = "make" | "canvas" | "creaties";
type Props = {
  activeView: StudioView;
  onViewChange: (view: StudioView) => void;
};
const PRIMARY: Array<{
  id: StudioView;
  label: string;
  icon: typeof Image;
  href?: string;
}> = [
  { id: "make", label: "Maken", icon: Image },
  { id: "canvas", label: "Canvas", icon: Palette },
  { id: "creaties", label: "Creaties", icon: LayoutGrid },
];
export function NavRail({ activeView, onViewChange }: Props) {
  return (
    <nav className="wc-nav-rail" aria-label="Studio navigatie">
      {" "}
      <div className="flex flex-1 flex-col items-center gap-1">
        {" "}
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          const className = `wc-nav-item${active ? " wc-nav-item--active" : ""}`;
          if (item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className={className}
                title={item.label}
              >
                {" "}
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />{" "}
                <span>{item.label}</span>{" "}
              </Link>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              className={className}
              title={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => onViewChange(item.id)}
            >
              {" "}
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />{" "}
              <span>{item.label}</span>{" "}
            </button>
          );
        })}{" "}
      </div>{" "}
      <div className="mt-auto flex flex-col items-center gap-1 pb-2">
        {" "}
        <button
          type="button"
          className="wc-nav-item"
          title="Help"
          aria-label="Help"
        >
          {" "}
          <HelpCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />{" "}
          <span>Help</span>{" "}
        </button>{" "}
        <button
          type="button"
          className="wc-nav-item"
          title="Meldingen"
          aria-label="Meldingen"
        >
          {" "}
          <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />{" "}
          <span>Alerts</span>{" "}
        </button>{" "}
        <Link href="/fumero/chat" className="wc-nav-item" title="Profiel">
          {" "}
          <User className="h-5 w-5" strokeWidth={1.75} aria-hidden />{" "}
          <span>Profiel</span>{" "}
        </Link>{" "}
      </div>{" "}
    </nav>
  );
}
