"use client";

import { formatOrganizationStatus, getStatusTone, type LifecycleAction } from "@/lib/api/organizations";
import { StatusBadge } from "@/components/common/production-ui";
import type { Organization } from "@/lib/api/generated/v1";

export function OrganizationList({
  organizations,
  loading,
  token,
  onOrganizationUpdated,
  onEditOrganization,
  onLifecycleAction,
}: {
  organizations: Organization[];
  loading: boolean;
  token: string;
  onOrganizationUpdated: (organization: Organization) => void;
  onEditOrganization: (organizationId: string) => void;
  onLifecycleAction: (action: LifecycleAction, organizationId: string, organizationName: string) => void;
}) {

  if (loading && organizations.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">Loading organizations...</p>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">No organizations found. Create your first organization above.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {/* Desktop header */}
      <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase text-slate-400 md:grid">
        <div>Organization</div>
        <div>Status</div>
        <div>Created</div>
        <div>Actions</div>
      </div>

      {organizations.map((org) => (
        <OrganizationRow
          key={org.id}
          organization={org}
          onEdit={() => onEditOrganization(org.id)}
          onSuspend={() => 
            onLifecycleAction("suspend", org.id, org.name)
          }
          onActivate={() => 
            onLifecycleAction("activate", org.id, org.name)
          }
          onRevoke={() =>
            onLifecycleAction("revoke", org.id, org.name)
          }
        />
      ))}
    </div>
  );
}

function OrganizationRow({
  organization,
  onEdit,
  onSuspend,
  onActivate,
  onRevoke,
}: {
  organization: Organization;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onRevoke: () => void;
}) {
  const canSuspend = organization.status === "ACTIVE";
  const canActivate = organization.status === "SUSPENDED" || organization.status === "PENDING";
  const canRevoke = organization.status !== "REVOKED" && organization.status !== "DELETED";

  return (
    <div className="grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4 text-sm md:grid-cols-[2fr_1fr_1fr_auto] md:items-center md:gap-4">
      {/* Organization Info */}
      <div className="min-w-0">
        <div className="font-medium text-white">{organization.name}</div>
        <div className="mt-1 font-mono text-xs text-slate-400">
          {organization.slug}
        </div>
        {organization.website && (
          <div className="mt-1 text-xs">
            <a
              href={organization.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 hover:text-cyan-200 transition"
            >
              {organization.website}
            </a>
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <div className="text-slate-300 md:hidden font-semibold">Status:</div>
        <StatusBadge tone={getStatusTone(organization.status)}>
          {formatOrganizationStatus(organization.status)}
        </StatusBadge>
      </div>

      {/* Created */}
      <div>
        <div className="text-slate-300 md:hidden font-semibold">Created:</div>
        <div className="text-slate-400">
          {/* Using placeholder since creation date is not in API response */}
          Recently
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onEdit}
          className="h-8 rounded border border-blue-300/30 px-3 text-xs font-medium text-blue-200 hover:bg-blue-300/10 transition"
        >
          Edit
        </button>
        {canActivate && (
          <button
            onClick={onActivate}
            className="h-8 rounded border border-emerald-300/30 px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-300/10 transition"
          >
            Activate
          </button>
        )}
        {canSuspend && (
          <button
            onClick={onSuspend}
            className="h-8 rounded border border-amber-300/30 px-3 text-xs font-medium text-amber-200 hover:bg-amber-300/10 transition"
          >
            Suspend
          </button>
        )}
        {canRevoke && (
          <button
            onClick={onRevoke}
            className="h-8 rounded border border-rose-300/30 px-3 text-xs font-medium text-rose-200 hover:bg-rose-300/10 transition"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
