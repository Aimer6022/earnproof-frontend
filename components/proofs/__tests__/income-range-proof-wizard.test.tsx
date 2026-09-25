/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IncomeRangeProofWizard } from "../income-range-proof-wizard";
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

const PAYMENT = {
  id: "pay-1",
  stellarTransactionHash: "tx-hash-1",
  sourceAddress: "GSRC...TEST",
  assetCode: "USDC",
  assetIssuer: null,
  occurredAt: "2026-08-01T00:00:00.000Z",
  classification: "INCOME" as const,
  isEligible: true,
};

async function syncAndSelectOnePayment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Sync" }));
  await waitFor(() => {
    expect(screen.getByText("USDC incoming payment")).toBeInTheDocument();
  });
  await user.click(screen.getByRole("checkbox", { name: "Select payment" }));
}

describe("IncomeRangeProofWizard", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedApiClient.mockImplementation((options) => {
      if (options.path === "/payments/sync") {
        return Promise.resolve(undefined);
      }
      if (options.path === "/payments") {
        return Promise.resolve([PAYMENT]);
      }
      return Promise.resolve(undefined);
    });
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION));
  });

  afterEach(() => {
    window.localStorage.removeItem(SESSION_KEY);
  });

  it("blocks advancing past range config with an inverted range", async () => {
    const user = userEvent.setup();
    render(<IncomeRangeProofWizard />);

    await syncAndSelectOnePayment(user);

    const [lowerInput, upperInput] = [
      screen.getByLabelText("Lower bound"),
      screen.getByLabelText("Upper bound"),
    ];
    await user.clear(lowerInput);
    await user.type(lowerInput, "500");
    await user.clear(upperInput);
    await user.type(upperInput, "100");

    expect(screen.getByText("Upper bound must be greater than the lower bound")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("blocks advancing past range config with an over-precise (too-narrow) range", async () => {
    const user = userEvent.setup();
    render(<IncomeRangeProofWizard />);

    await syncAndSelectOnePayment(user);

    const [lowerInput, upperInput] = [
      screen.getByLabelText("Lower bound"),
      screen.getByLabelText("Upper bound"),
    ];
    await user.clear(lowerInput);
    await user.type(lowerInput, "100");
    await user.clear(upperInput);
    await user.type(upperInput, "110");

    expect(screen.getByText(/at least/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("allows advancing with a valid range and shows the range (never an exact amount) on the disclosure step", async () => {
    const user = userEvent.setup();
    render(<IncomeRangeProofWizard />);

    await syncAndSelectOnePayment(user);

    // Defaults (100/500) already form a valid range.
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Disclosure Preview" })).toBeInTheDocument();
    expect(screen.getByText(/Income range: 100 - 500 USDC/)).toBeInTheDocument();
    // The disclosure list must only ever show the range and counts, never a
    // computed exact aggregate figure.
    const disclosedList = screen.getByText("What will be disclosed").closest("div");
    expect(disclosedList).not.toHaveTextContent(/aggregate:/i);
  });

  it("carries the range through to the confirmation step without ever showing an exact figure", async () => {
    const user = userEvent.setup();
    render(<IncomeRangeProofWizard />);

    await syncAndSelectOnePayment(user);
    await user.click(screen.getByRole("button", { name: "Next" })); // -> disclosure preview
    await user.click(screen.getByRole("button", { name: "Next" })); // -> confirmation

    expect(screen.getByRole("heading", { name: "Confirmation" })).toBeInTheDocument();
    expect(screen.getByText("100 - 500 USDC")).toBeInTheDocument();
  });

  it("requires at least one selected payment before proceeding", async () => {
    const user = userEvent.setup();
    render(<IncomeRangeProofWizard />);

    await user.click(screen.getByRole("button", { name: "Sync" }));
    await waitFor(() => {
      expect(screen.getByText("USDC incoming payment")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
