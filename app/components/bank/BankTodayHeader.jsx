"use client";

// The bank-first Today header (Future Bank, Part 1). A first-time user must
// recognise this as a bank in seconds: accounts + Available to Spend + the
// four bank actions + the Current Ripple + the next money moment + recent
// transactions. ONE main number - Available to Spend - not a misleading
// Total Balance. Vertical hierarchy, no dense card wall.

import styles from "./bank.module.css";
import { CurrentRippleStrip } from "./CurrentRippleStrip.jsx";

const KIND_LABEL = {
  current: "Current",
  savings: "Savings",
  fixed_deposit: "Fixed deposit",
  credit_card: "Credit card",
  multi_currency: "Multi-currency",
  goal_wallet: "Goal wallet",
};

function sgd(n) {
  const v = Math.round(Number(n) || 0);
  return `SGD ${v.toLocaleString()}`;
}

export function BankTodayHeader({ twin, ripple, status, onOpen, onRippleAction }) {
  const isLoading = status === "loading" && !twin;
  const empty = twin?.isEmpty;

  if (isLoading) {
    return <div className={styles.bank}><p className={styles.provenance}>Loading your accounts…</p></div>;
  }

  if (empty) {
    return (
      <div className={styles.bank}>
        <div className={styles.emptyState}>
          <p>FutureOS does not have your accounts yet.</p>
          <p className={styles.provenance}>Connect a bank, import a statement, or enter your accounts manually — nothing is assumed.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.actionBtn} onClick={() => onOpen?.("crossBankData")}>Connect</button>
            <button type="button" className={styles.actionBtn} onClick={() => onOpen?.("decodeDocument")}>Import</button>
            <button type="button" className={styles.actionBtn} onClick={() => onOpen?.("assetProfile")}>Enter manually</button>
          </div>
        </div>
      </div>
    );
  }

  const s2s = twin?.safeToSpend ?? null;
  const bd = s2s?.breakdown ?? {};
  const balances = twin?.balances ?? [];
  const fb = twin?.futureBalance ?? null;
  const nextIncome = s2s?.nextIncome ?? null;
  const nextBill = s2s?.nearTermObligationsList?.[0] ?? null;

  return (
    <div className={styles.bank}>
      {/* 1 - the one main number */}
      <div className={styles.headline}>
        <span className={styles.headlineLabel}>Available to spend</span>
        <span className={`${styles.headlineAmount} ${s2s?.belowProtectedFloor ? styles.headlineWarn : ""}`}>{sgd(s2s?.safeToSpend ?? 0)}</span>
        <span className={styles.headlineSub}>
          {sgd(bd.postedLiquidCash)} liquid · {sgd(bd.protectedReserve)} protected · {sgd(bd.alreadyCommitted)} committed · {sgd(bd.nearTermObligations)} due soon
        </span>
      </div>

      {/* spoken-for / protected / restricted / invested */}
      <div className={styles.breakdownRow}>
        <span>Available now <b>{sgd(twin?.twin?.balanceBreakdown?.availableNow)}</b></span>
        <span>Spoken for <b>{sgd(twin?.twin?.balanceBreakdown?.spokenFor)}</b></span>
        <span>Protected <b>{sgd(twin?.twin?.balanceBreakdown?.protectedFor)}</b></span>
        <span>Restricted <b>{sgd(twin?.twin?.balanceBreakdown?.restricted)}</b></span>
        <span>Invested <b>{sgd(twin?.twin?.balanceBreakdown?.invested)}</b></span>
      </div>

      {/* 2 - the four bank actions */}
      <div className={styles.actions}>
        <button type="button" className={styles.actionBtn} onClick={() => onOpen?.("paynow")}>Pay</button>
        <button type="button" className={styles.actionBtn} onClick={() => onOpen?.("scanPay")}>Scan &amp; Pay</button>
        <button type="button" className={styles.actionBtn} onClick={() => onOpen?.("paynow")}>Transfer</button>
        <button type="button" className={styles.actionBtn} onClick={() => onOpen?.("fx")}>FX</button>
      </div>

      {/* 3 - accounts + balances */}
      <ul className={styles.accountList}>
        {balances.map((a) => (
          <li key={a.accountId} className={styles.accountRow}>
            <span>
              <span className={styles.accountName}>{a.displayName || KIND_LABEL[a.kind] || a.kind}</span>
              <span className={styles.accountKind}>{KIND_LABEL[a.kind] ?? a.kind}</span>
            </span>
            <span className={styles.accountBal}>
              {a.isLiability ? `− ${sgd(a.postedBalance)}` : sgd(a.postedBalance)}
              {a.pendingAmount ? <span className={styles.accountPending}>{sgd(a.pendingAmount)} pending</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {/* 4 - Current Ripple, persistent */}
      <CurrentRippleStrip ripple={ripple} onAction={onRippleAction} />

      {/* 5 - next money moment */}
      {(nextIncome || nextBill) ? (
        <p className={styles.nextMoment}>
          {nextIncome ? `Next income: ${sgd(nextIncome.amount)} in ${nextIncome.inDays} day${nextIncome.inDays === 1 ? "" : "s"}. ` : ""}
          {nextBill ? `Next bill: ${nextBill.label} ${sgd(nextBill.amount)} on ${nextBill.dueDate}.` : ""}
          {fb?.lowestPoint ? ` Lowest projected balance: ${sgd(fb.lowestPoint.balance)} at ${fb.lowestPoint.label} (${fb.lowestPoint.confidence}).` : ""}
        </p>
      ) : null}

      {/* 6 - recent transactions */}
      <div>
        <p className={styles.sectionTitle}>Recent transactions</p>
        <ul className={styles.txnList}>
          {(twin?.recentTransactions ?? []).slice(0, 6).map((tx) => (
            <li key={tx.id} className={styles.txnRow}>
              <span>
                <span className={styles.txnMerchant}>{tx.merchant || tx.category || tx.channel || "Payment"}</span>
                <span className={styles.txnMeta}> {tx.category ?? ""} {tx.status !== "posted" ? `· ${tx.status}` : ""}</span>
              </span>
              <span className={`${styles.txnAmt} ${tx.direction === "credit" ? styles.txnIn : ""} ${tx.status === "pending" ? styles.txnPending : ""}`}>
                {tx.direction === "credit" ? "+" : "−"} {sgd(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.actionBtn} onClick={() => onOpen?.("changeLedger")} style={{ marginTop: 8 }}>
          All transactions
        </button>
      </div>
    </div>
  );
}
