// Cross-goal read layer for micro-insurance triggering, mirroring lib/loan-context.js's pattern:
// parallel reads per loan purpose, no SQL join. Needs total PRINCIPAL across every confirmed loan
// (not the monthly-installment totals lib/loan-context.js/lib/investment-context.js already
// expose), since a coverage gap is judged against total liability, not monthly cashflow.

import * as loanStore from "./loan-store.js";
import { LOAN_PURPOSES } from "./loan-finance.js";

export async function getTotalConfirmedLoanLiabilities() {
  const results = await Promise.all(
    Object.keys(LOAN_PURPOSES).map(async (purpose) => {
      const session = await loanStore.getOrCreateSession(loanStore.DEFAULT_PROFILE_KEY, purpose);
      return loanStore.getLatestArtifact(session.id, "stage1", "confirmed_loan");
    }),
  );
  return results.filter(Boolean).reduce((sum, loan) => sum + loan.loan_amount, 0);
}
