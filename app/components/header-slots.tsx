"use client";
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const HeaderSlots = createContext<{
  breadcrumb: HTMLDivElement | null;
}>({ breadcrumb: null });

export function PageHeaderContent({ breadcrumb }: { breadcrumb: ReactNode }) {
  const slots = useContext(HeaderSlots);
  return <>{slots.breadcrumb && createPortal(breadcrumb, slots.breadcrumb)}</>;
}
