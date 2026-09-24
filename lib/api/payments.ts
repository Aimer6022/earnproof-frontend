import { apiClient, bearer, retryMutation } from "./client";
import type { PaymentSyncResult } from "./generated/v1";

/**
 * Triggers a payment synchronization pass (#138). `POST /payments/sync`
 * is a mutation and is intentionally never auto-retried by this client
 * (see retryMutation), matching this API's documented retry policy.
 *
 * The response is a one-shot summary (created/updated/skipped counts);
 * the API does not expose a resumable cursor or a separate progress/status
 * endpoint, so callers can distinguish a completed sync's outcome
 * (no-op / partial / full) from these counts, but cannot resume a sync
 * from a server-provided checkpoint mid-run, only retry the whole
 * operation.
 */
export async function syncPayments(token: string, signal: AbortSignal): Promise<PaymentSyncResult> {
  return retryMutation(async (signal) => {
    return apiClient<PaymentSyncResult>({
      path: "/payments/sync",
      method: "POST",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

export type PaymentSyncOutcome = "noop" | "partial" | "complete";

/**
 * Classifies a sync result for display. "Partial" covers any run where at
 * least one payment was skipped alongside a created/updated one; a run
 * that skipped everything and changed nothing is a no-op, not a partial
 * failure, since the API gives no way to distinguish "skipped because
 * already synced" from "skipped because of an error" in this response
 * shape.
 */
export function classifySyncOutcome(result: PaymentSyncResult): PaymentSyncOutcome {
  const created = result.created ?? 0;
  const updated = result.updated ?? 0;
  const skipped = result.skipped ?? 0;

  if (created === 0 && updated === 0 && skipped === 0) {
    return "noop";
  }
  if (skipped > 0) {
    return "partial";
  }
  return "complete";
}
