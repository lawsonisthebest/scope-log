"use client";
import Link from "next/link";
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) { return <div className="empty"><h1 className="text-xl font-semibold text-white">We couldn’t load this page.</h1><p>Your saved work is still available. Try again in a moment.</p><button className="button" onClick={retry}>Try again</button><Link href="/" className="text-sm">Back to dashboard</Link></div>; }
