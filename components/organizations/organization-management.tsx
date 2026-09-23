import { useCallback, useEffect, useRef, useState } from "react";
import { CreateOrganizationForm } from "./create-organization-form";
import { OrganizationList } from "./organization-list";
import { OrganizationEditForm } from "./organization-edit-form";
import { LifecycleConfirmationDialog } from "./lifecycle-confirmation-dialog";
import { getOrganizations, performLifecycleAction, type LifecycleAction } from "@/lib/api/organizations";
import type { OrganizationWithRevision } from "@/lib/api/organizations";

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

export function OrganizationManagement() {
  const [session] = useState<SessionData | null>(() => readStoredSession());
  const [organizations, setOrganizations] = useState<OrganizationWithRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<{
    action: LifecycleAction;
    organizationId: string;
    organizationName: string;
  } | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionToken = session?.token ?? null;

  const loadOrganizations = useCallback(async () => {
    if (!sessionToken) {
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const orgs = await getOrganizations(sessionToken, controller.signal);
      if (!controller.signal.aborted) {
        setOrganizations(orgs);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError("Failed to load organizations. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [sessionToken]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        void loadOrganizations();
      }
    });
    
    // Cleanup on unmount
    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadOrganizations]);

  const handleOrganizationCreated = useCallback((organization: OrganizationWithRevision) => {
    setOrganizations(prev => [...prev, organization]);
  }, []);

  const handleOrganizationUpdated = useCallback((updatedOrg: OrganizationWithRevision) => {
    // Cache refresh: only update after confirmed write success
    setOrganizations(prev => prev.map(org => 
      org.id === updatedOrg.id ? updatedOrg : org
    ));
    setEditingOrgId(null);
  }, []);

  const handleLifecycleAction = useCallback(async () => {
    if (!lifecycleAction || !sessionToken) {
      return;
    }

    setLifecycleLoading(true);

    try {
      const controller = new AbortController();
      const result = await performLifecycleAction(
        sessionToken,
        lifecycleAction.organizationId,
        lifecycleAction.action,
        controller.signal
      );

      if (result.success) {
        // Cache refresh: only update after confirmed write success
        handleOrganizationUpdated(result.data);
        setLifecycleAction(null);
      } else {
        setError(result.error.message);
        setLifecycleAction(null);
      }
    } finally {
      setLifecycleLoading(false);
    }
  }, [lifecycleAction, sessionToken, handleOrganizationUpdated]);

  // Check if user has admin role
  const isAdmin = session?.user.role === "ADMIN" || session?.user.role === "ISSUER";

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">Authentication Required</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Please authenticate with a Stellar wallet to access organization management.
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
          Organization management requires administrative access. Contact your administrator if you need access to organization management tools.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 sm:gap-10">
      <CreateOrganizationForm 
        token={session.token}
        onOrganizationCreated={handleOrganizationCreated}
      />

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Organizations</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Manage organizations, their status, and associated metadata.
            </p>
          </div>
          <button
            className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={loading}
            onClick={loadOrganizations}
            type="button"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        {editingOrgId ? (
          <div className="grid gap-6 rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div>
              <h3 className="text-lg font-semibold text-white">Edit Organization</h3>
              <p className="mt-1 text-sm text-slate-400">
                Update organization metadata
              </p>
            </div>
            {organizations.find(org => org.id === editingOrgId) && (
              <OrganizationEditForm
                organization={organizations.find(org => org.id === editingOrgId)!}
                token={session.token}
                onOrganizationUpdated={handleOrganizationUpdated}
                onCancel={() => setEditingOrgId(null)}
              />
            )}
          </div>
        ) : (
          <OrganizationList
            organizations={organizations}
            loading={loading}
            token={session.token}
            onOrganizationUpdated={handleOrganizationUpdated}
            onEditOrganization={(orgId) => setEditingOrgId(orgId)}
            onLifecycleAction={(action, orgId, orgName) =>
              setLifecycleAction({ action, organizationId: orgId, organizationName: orgName })
            }
          />
        )}
      </section>

      {/* Lifecycle confirmation dialog */}
      {lifecycleAction && (
        <LifecycleConfirmationDialog
          action={lifecycleAction.action}
          organizationName={lifecycleAction.organizationName}
          onConfirm={handleLifecycleAction}
          onCancel={() => setLifecycleAction(null)}
          isProcessing={lifecycleLoading}
        />
      )}
    </div>
  );
}
