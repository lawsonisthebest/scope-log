"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, PanelLeftClose, Search } from "lucide-react";
import { Show, UserButton, useUser } from "@clerk/nextjs";
import { navItems } from "../lib/types";

export function Sidebar({
  onNavigate,
  onSearch,
}: {
  onNavigate: () => void;
  onSearch: () => void;
}) {
  const pathname = usePathname(),
    { user } = useUser();
  const initials = [user?.firstName, user?.lastName]
    .map((name) => name?.trim().charAt(0) || "")
    .join("")
    .toUpperCase();
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="workspace-dot" aria-hidden="true">
          {initials}
        </span>
        <div>
          <strong>
            {user?.firstName
              ? `${user.firstName}'s workspace`
              : "Personal workspace"}
          </strong>
        </div>
      </div>
      <button className="sidebar-search" onClick={onSearch}>
        <Search size={15} />
        <span>Search</span>
        <kbd>⌘ K</kbd>
      </button>
      <nav aria-label="Main navigation">
        {navItems.map((item) => {
          const href = item.id === "dashboard" ? "/" : `/${item.id}`,
            active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(`${href}/`)),
            Icon = item.icon;
          return (
            <Link
              href={href}
              key={item.id}
              className={`nav-link ${active ? "is-active" : ""} ${item.id === "skills" ? "nav-section" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <Show when="signed-in">
          <div className="account">
            <UserButton />
            <div>
              <strong>
                {user?.fullName || user?.firstName || "Researcher"}
              </strong>
              <span>Account settings</span>
            </div>
          </div>
        </Show>
        <Show when="signed-out">
          <Link href="/sign-in" className="button w-full" onClick={onNavigate}>
            Sign in
            <ArrowUpRight size={15} />
          </Link>
        </Show>
      </div>
      <button
        className="mobile-sidebar-close icon-button"
        aria-label="Close navigation"
        onClick={onNavigate}
      >
        <PanelLeftClose size={18} />
      </button>
    </aside>
  );
}
