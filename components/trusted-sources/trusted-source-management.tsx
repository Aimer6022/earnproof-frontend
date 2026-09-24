"use client";

import { useState } from "react";
import { TrustedSourceForm } from "./trusted-source-form";
import type { TrustedSourceConfig } from "@/lib/api/trusted-sources";

const SESSION_KEY = "earnproof.session";

type SessionData = {
  token: string;
  user: {
    id: string;
    role: string;
  };
};

function readStoredSession(): SessionData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(SESSION_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as SessionData;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function TrustedSourceManagement() {
  const [session] = useState<SessionData | null>(() => readStoredSession());
  const [saved, setSaved] = useState<TrustedSourceConfig | null>(null);

  const isAdmin = session?.user.role === "ADMIN" || session?.user.role === "ISSUER";

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">Authentication Required</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Please authenticate with a Stellar wallet to manage trusted sources.
        </p>
        <a
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
          href="/proofs"
        >
          Connect Wallet
        </a>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-5">
        <h2 className="text-xl font-semibold text-amber-100">Access Restricted</h2>
        <p className="mt-2 text-sm leading-6 text-amber-200">
          Trusted source management requires administrative access.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <TrustedSourceForm token={session.token} onSave={setSaved} />
      {saved && (
        <p className="text-sm text-slate-400" role="status">
          Saved &quot;{saved.name}&quot;.
        </p>
      )}
    </div>
  );
}
