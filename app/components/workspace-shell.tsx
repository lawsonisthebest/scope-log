"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Sidebar } from "./shell";
import { HeaderSlots } from "./header-slots";
import { CommandSearch } from "./command-search";
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false),
    content = useRef<HTMLDivElement>(null);
  const [breadcrumb, setBreadcrumb] = useState<HTMLDivElement | null>(null);
  const isProject = /^\/workspaces\/[^/]+\/projects\/[^/]+$/.test(pathname);
  const section =
    pathname === "/"
      ? "Overview"
      : pathname.startsWith("/sign-")
        ? "Access"
        : pathname.startsWith("/skills") ? "Progress" : pathname.split("/")[1];
  useEffect(() => {
    content.current?.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch((value) => !value);
      }
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <HeaderSlots.Provider value={{ breadcrumb }}>
      <div className={`app-frame ${menu ? "nav-open" : ""}`}>
        {menu && (
          <button
            className="nav-scrim"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <Sidebar
          onNavigate={() => setMenu(false)}
          onSearch={() => {
            setSearch(true);
            setMenu(false);
          }}
        />
        <div className="app-body">
          <header className={`topbar ${isProject ? "project-topbar" : ""}`}>
            <div className="topbar-location">
              <button
                className="mobile-menu icon-button"
                aria-label="Open navigation"
                onClick={() => setMenu(true)}
              >
                <Menu size={18} />
              </button>
              <div ref={setBreadcrumb} className="header-breadcrumb-slot" />
              {!isProject && <strong>{section}</strong>}
            </div>
            <button
              className="topbar-search"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <Search size={15} />
              <span>Search</span>
              <kbd>⌘ K</kbd>
            </button>
          </header>
          <div
            ref={content}
            id="page-content"
            tabIndex={-1}
            role="main"
            aria-label="Page content"
            className="page-content"
          >
            <div className="page-container">{children}</div>
          </div>
        </div>
        {search && <CommandSearch onClose={() => setSearch(false)} />}
      </div>
    </HeaderSlots.Provider>
  );
}

