import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
export default async function SettingsPage() {
  const {userId}=await auth();if(!userId)redirect("/sign-in");
  return <div className="page"><header className="page-header"><p className="eyebrow">Your account</p><h1>Settings</h1><p>Manage your profile, sign-in security, and assessment data.</p></header><section className="panel my-6 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">Export your data</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[#99a8b1]">Download your workspaces, projects, findings, evidence, reports, notes, contacts, skills, and time entries as JSON. Attachments are included as Base64 data.</p></div><a className="button-secondary" href="/api/export"><Download size={14}/>Export all data</a></section><section className="panel overflow-x-auto"><h2 className="mb-4 text-sm font-semibold">Profile &amp; security</h2><UserProfile routing="hash" appearance={{elements:{rootBox:"w-full",cardBox:"w-full shadow-none",card:"bg-transparent shadow-none border-0 w-full"}}}/></section></div>;
}
