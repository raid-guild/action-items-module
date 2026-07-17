import Link from "next/link";
import { portalModulesUrl } from "@/lib/auth/session";

export default async function LaunchErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-2xl">
        <h1 className="font-heading text-2xl font-semibold">Launch expired or unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">Return to Portal and launch Action Items again. No launch token was stored.</p>
        {reason && <p className="mt-3 font-mono text-xs text-muted-foreground">{reason}</p>}
        <Link className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href={portalModulesUrl()}>Return to Portal modules</Link>
      </div>
    </main>
  );
}
