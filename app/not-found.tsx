import Link from "next/link";
export default function NotFound() { return <div className="empty"><p className="eyebrow">404 · Not found</p><h1 className="text-2xl font-semibold text-white">This page isn’t available.</h1><p>It may have been removed, or you may not have access.</p><Link href="/workspaces" className="button">Back to workspaces</Link></div>; }
