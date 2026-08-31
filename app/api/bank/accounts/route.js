import { getCurrentUserId } from "../../../../lib/auth.js";
import { listBankAccounts, createBankAccount } from "../../../../lib/bank/accounts-store.js";
import { getAccountBalances } from "../../../../lib/transaction-ledger/store.js";

export const runtime = "nodejs";

// GET /api/bank/accounts -> the customer's accounts with ledger-derived
// balances (posted / available / pending). Balances are never stored.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [accounts, balances] = await Promise.all([listBankAccounts(userId), getAccountBalances(userId)]);
    const balById = Object.fromEntries(balances.map((b) => [b.accountId, b]));
    const rows = accounts.map((a) => ({
      ...a,
      postedBalance: balById[a.id]?.postedBalance ?? 0,
      availableBalance: balById[a.id]?.availableBalance ?? 0,
      pendingAmount: balById[a.id]?.pendingAmount ?? 0,
    }));
    return Response.json({ accounts: rows });
  } catch (error) {
    console.error("[bank/accounts] failed:", error?.message);
    return Response.json({ error: "accounts_unavailable" }, { status: 500 });
  }
}

// POST /api/bank/accounts -> add an account the customer confirms
// (manual entry). A real bank sync would set source_type: 'bank_synced'.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const account = await createBankAccount(userId, {
      kind: body.kind,
      displayName: body.displayName,
      institution: body.institution,
      currency: body.currency,
      maskedNumber: body.maskedNumber,
      creditLimit: body.creditLimit,
      goalDomain: body.goalDomain,
      sourceType: "user_confirmed",
    });
    return Response.json({ account }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
