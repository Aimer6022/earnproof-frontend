/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AggregateEarningsProofWizard } from "../aggregate-earnings-proof-wizard";
import { apiClient } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiClient: jest.fn(),
  bearer: (token: string) => ({ Authorization: `Bearer ${token}` }),
  retryMutation: (fn: (signal: AbortSignal) => Promise<unknown>, signal: AbortSignal) => fn(signal),
}));

const mockedApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

const SESSION_KEY = "earnproof.session";

const SESSION = {
  token: "test-token",
  user: {
    id: "user-1",
    walletAddress: "GABC...TEST",
    walletHash: "wh_test",
    role: "worker",
  },
};

const USDC_PAYMENT_1 = {
  id: "pay-1",
  stellarTransactionHash: "tx-hash-1",
  sourceAddress: "GSRC...TEST",
  assetCode: "USDC",
  assetIssuer: null,
  occurredAt: "2026-08-01T00:00:00.000Z",
  classification: "INCOME" as const,
  isEligible: true,
};

const USDC_PAYMENT_2 = { ...USDC_PAYMENT_1, id: "pay-2", stellarTransactionHash: "tx-hash-2" };

const XLM_PAYMENT = {
  ...USDC_PAYMENT_1,
  id: "pay-3",
  stellarTransactionHash: "tx-hash-3",
  assetCode: "XLM",
};

describe("AggregateEarningsProofWizard", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION));
  });

  afterEach(() => {
    window.localStorage.removeItem(SESSION_KEY);
  });

  it("cannot select the same payment twice through client state", async () => {
    mockedApiClient.mockImplementation((options) => {
      if (options.path === "/payments/sync") {
        return Promise.resolve(undefined);
      }
      return Promise.resolve([USDC_PAYMENT_1]);
    });

    const user = userEvent.setup();
    render(<AggregateEarningsProofWizard />);

    await user.click(screen.getByRole("button", { name: "Sync" }));
    await waitFor(() => {
      expect(screen.getByText("USDC incoming payment")).toBeInTheDocument();
    });

    const checkbox = screen.getByRole("checkbox", { name: "Select payment" });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    // Clicking the same payment's checkbox again toggles it off - the
    // underlying selection is a de-duplicated id list, so there is no path
    // through the UI that lets one payment id appear twice in it.
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("shows an empty-eligibility message when no payments are loaded", async () => {
    mockedApiClient.mockImplementation(() => Promise.resolve([]));

    render(<AggregateEarningsProofWizard />);

    expect(screen.getByText("No payments loaded yet.")).toBeInTheDocument();
  });

  it("warns when selected sources mix assets, and does not when they don't", async () => {
    mockedApiClient.mockImplementation((options) => {
      if (options.path === "/payments/sync") {
        return Promise.resolve(undefined);
      }
      return Promise.resolve([USDC_PAYMENT_1, XLM_PAYMENT]);
    });

    const user = userEvent.setup();
    render(<AggregateEarningsProofWizard />);

    await user.click(screen.getByRole("button", { name: "Sync" }));
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox", { name: "Select payment" })).toHaveLength(2);
    });

    const checkboxes = screen.getAllByRole("checkbox", { name: "Select payment" });
    await user.click(checkboxes[0]);
    expect(screen.queryByText(/multiple assets/i)).not.toBeInTheDocument();

    await user.click(checkboxes[1]);
    expect(screen.getByText(/multiple assets/i)).toBeInTheDocument();
  });

  it("blocks advancing to the next step while sources mix assets", async () => {
    mockedApiClient.mockImplementation((options) => {
      if (options.path === "/payments/sync") {
        return Promise.resolve(undefined);
      }
      return Promise.resolve([USDC_PAYMENT_1, XLM_PAYMENT]);
    });

    const user = userEvent.setup();
    render(<AggregateEarningsProofWizard />);

    await user.click(screen.getByRole("button", { name: "Sync" }));
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox", { name: "Select payment" })).toHaveLength(2);
    });

    const checkboxes = screen.getAllByRole("checkbox", { name: "Select payment" });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("allows advancing once a single-asset selection is made", async () => {
    mockedApiClient.mockImplementation((options) => {
      if (options.path === "/payments/sync") {
        return Promise.resolve(undefined);
      }
      return Promise.resolve([USDC_PAYMENT_1, USDC_PAYMENT_2]);
    });

    const user = userEvent.setup();
    render(<AggregateEarningsProofWizard />);

    await user.click(screen.getByRole("button", { name: "Sync" }));
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox", { name: "Select payment" })).toHaveLength(2);
    });

    await user.click(screen.getAllByRole("checkbox", { name: "Select payment" })[0]);

    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });
});
