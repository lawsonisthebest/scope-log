import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  FileText,
  Files,
  LayoutDashboard,
  Settings2,
  ShieldAlert,
} from "lucide-react";

export type View =
  | "dashboard"
  | "workspaces"
  | "findings"
  | "evidence"
  | "reports"
  | "skills"
  | "settings";

export const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "workspaces", label: "Workspaces", icon: BriefcaseBusiness },
  { id: "findings", label: "Findings", icon: ShieldAlert },
  { id: "evidence", label: "Evidence", icon: Files },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "skills", label: "Progress", icon: ChartNoAxesCombined },
  { id: "settings", label: "Settings", icon: Settings2 },
];


