"use client";

// The Future Bank vertical slice - ONE visually reviewable end-to-end
// experience, no legacy simulator screens, no feature catalogue wall.
//
//   Welcome -> Reality setup -> Today -> Explore (curated) -> Home goal
//   -> Change Receipt
//
// Every number is real (server-computed + persisted). Estimates are
// labelled. No demo / mock / preset persona / fake bank success.

import { useCallback, useEffect, useState } from "react";
import styles from "../components/bank/bank.module.css";
import slice from "./slice.module.css";
import { LoadingState, ErrorState } from "../components/bank/AsyncState.jsx";
import { RealityEntry } from "../components/bank/RealityEntry.jsx";
import { CsvImportWizard } from "../components/bank/CsvImportWizard.jsx";
import { parseMoneyInput, formatMoney } from "../../lib/money-input.js";

const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;

export function FutureBankSlice() {
  const [auth, setAuth] = useState("checking"); // checking | anon | in
  const [step, setStep] = useState("welcome");
  const [twin, setTwin] = useState(null);
  const [twinState, setTwinState] = useState("idle");
  const [explain, setExplain] = useState(null);

  // ---- auth (real server session) --------------------------------
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuth(d?.id ? "in" : "anon"))
      .catch(() => setAuth("anon"));
  }, []);

  const loadTwin = useCallback(async () => {
    setTwinState("loading");
    try {
      const r = await fetch("/api/financial-twin", { headers: { "cache-control": "no-cache" } });
      if (!r.ok) {
        setTwinState(r.status === 401 ? "anon" : "error");
        return;
      }
      setTwin(await r.json());
      setTwinState("ready");
    } catch {
      setTwinState("error");
    }
  }, []);

  useEffect(() => {
    if (auth === "in") loadTwin();
  }, [auth, loadTwin]);

  // after setup completes, land on Today
  const finishSetup = useCallback(async () => {
    await loadTwin();
    setStep("today");
  }, [loadTwin]);

  if (auth === "checking") return <Frame><LoadingState label="Opening Future Bank…" /></Frame>;
  if (auth === "anon") return <Frame><AnonNotice /></Frame>;

  return (
    <Frame>
      {step === "welcome" && <Welcome onStart={() => setStep(twin && !twin.isEmpty ? "today" : "setup")} hasData={twin && !twin.isEmpty} />}
      {step === "setup" && <RealitySetup onDone={finishSetup} />}
      {step === "today" && (
        <Today
          twin={twin}
          state={twinState}
          onReload={loadTwin}
          onExplain={setExplain}
          onNext={() => setStep("explore")}
        />
      )}
      {step === "explore" && (
        <Explore twin={twin} onHome={() => setStep("home")} onBack={() => setStep("today")} onProblem={() => setStep("today")} />
      )}
      {step === "home" && <HomeGoal onBack={() => setStep("explore")} onReceipt={() => loadTwin()} />}

      {explain && <ExplainSheet item={explain} onClose={() => setExplain(null)} />}
    </Frame>
  );
}

// ---------------------------------------------------------------------

function Frame({ children }) {
  return (
    <main className={slice.frame}>
      <div className={`${styles.bank} ${slice.col}`}>{children}</div>
    </main>
  );
}

function AnonNotice() {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>Please sign in first</p>
      <p className={styles.provenance}>
        This preview needs a real account. Open <a href="/login">/login</a> (or <a href="/signup">/signup</a>), then come back to <a href="/showcase">/showcase</a>.
      </p>
    </div>
  );
}

// 1 - Welcome -------------------------------------------------------
function Welcome({ onStart, hasData }) {
  return (
    <section className={slice.welcome} aria-labelledby="fb-welcome">
      <h1 id="fb-welcome" className={slice.h1}>How Future Bank works</h1>
      <ol className={slice.ideas}>
        <li>
          <strong>Your real money.</strong> Your accounts, balances and transactions — entered or imported, never assumed.
        </li>
        <li>
          <strong>What it means.</strong> One honest number: how much is actually safe to spend right now.
        </li>
        <li>
          <strong>Your next decision.</strong> When you plan something, you see exactly what changes and what to do next.
        </li>
      </ol>
      <button type="button" className={styles.primaryBtn} onClick={onStart}>
        {hasData ? "Go to my money picture" : "Set up my money picture"}
      </button>
    </section>
  );
}

// 2 - Reality setup ----------------------------------------------
function RealitySetup({ onDone }) {
  const [mode, setMode] = useState(null); // null | manual | csv
  if (mode === "manual") return <RealityEntry onDone={onDone} onOpen={() => setMode("csv")} />;
  if (mode === "csv") return <CsvImportWizard onDone={onDone} />;
  return (
    <section aria-labelledby="fb-setup">
      <h1 id="fb-setup" className={slice.h1}>Add your money</h1>
      <p className={styles.provenance}>Two ways in. You can add more any time. Nothing is assumed for you.</p>
      <div className={styles.choiceList}>
        <button type="button" className={styles.choiceBtn} onClick={() => setMode("manual")}>
          <span className={styles.choiceName}>Add one account manually</span>
          <span className={styles.choiceHint}>Name it, set the balance — about a minute.</span>
        </button>
        <button type="button" className={styles.choiceBtn} onClick={() => setMode("csv")}>
          <span className={styles.choiceName}>Import transactions by CSV</span>
          <span className={styles.choiceHint}>Upload a statement export; preview before it's saved.</span>
        </button>
      </div>
      <button type="button" className={styles.ghostBtn} onClick={onDone} style={{ marginTop: 12 }}>
        Skip for now
      </button>
    </section>
  );
}

// 3 - Today ------------------------------------------------------
function Today({ twin, state, onReload, onExplain, onNext }) {
  if (state === "loading" || state === "idle") return <LoadingState label="Loading your money…" />;
  if (state === "error") return <ErrorState onRetry={onReload} message="Your money picture didn't load." />;

  if (!twin || twin.isEmpty) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No accounts yet</p>
        <p className={styles.provenance}>Add an account or import transactions to see your picture.</p>
        <button type="button" className={styles.primaryBtn} onClick={onReload} style={{ marginTop: 8 }}>
          Refresh
        </button>
      </div>
    );
  }

  const s2s = twin.safeToSpend ?? {};
  const bd = s2s.breakdown ?? {};
  const nextIn = s2s.nextIncome;
  const nextBill = s2s.nearTermObligationsList?.[0];
  const txns = twin.recentTransactions ?? [];

  const explainItems = {
    available: { label: "Available to spend", value: sgd(s2s.safeToSpend), how: "Liquid cash minus bills due before your next income, minus your protected safety reserve, minus what sealed plans already claim.", parts: [["Liquid cash", sgd(bd.postedLiquidCash)], ["Due before next income", `- ${sgd(bd.nearTermObligations)}`], ["Protected reserve", `- ${sgd(bd.protectedReserve)}`], ["Committed to plans", `- ${sgd(bd.alreadyCommitted)}`]] },
  };

  return (
    <section aria-labelledby="fb-today">
      <h1 id="fb-today" className={slice.h1}>Today</h1>

      <div className={styles.headline}>
        <span className={styles.headlineLabel}>Available to spend</span>
        <button type="button" className={`${styles.headlineAmount} ${s2s.belowProtectedFloor ? styles.headlineWarn : ""} ${slice.explainable}`} onClick={() => onExplain(explainItems.available)}>
          {sgd(s2s.safeToSpend)} <span className={slice.explainMark} aria-hidden>ⓘ</span>
        </button>
        <span className={styles.headlineSub}>Tap any figure to see how it's worked out.</span>
      </div>

      <div className={styles.breakdownRow}>
        <span>Available now <b>{sgd(twin.twin?.balanceBreakdown?.availableNow)}</b></span>
        <span>Spoken for <b>{sgd(twin.twin?.balanceBreakdown?.spokenFor)}</b></span>
        <span>Protected <b>{sgd(twin.twin?.balanceBreakdown?.protectedFor)}</b></span>
      </div>

      <ul className={styles.accountList}>
        {(twin.balances ?? []).map((a) => (
          <li key={a.accountId} className={styles.accountRow}>
            <span>
              <span className={styles.accountName}>{a.displayName || a.kind}</span>
              <span className={styles.accountKind}>{a.kind}</span>
            </span>
            <button
              type="button"
              className={slice.explainable}
              onClick={() => onExplain({ label: a.displayName || a.kind, value: a.isLiability ? `− ${sgd(a.postedBalance)}` : sgd(a.postedBalance), how: `Posted balance from ${a.pendingAmount ? `${sgd(a.pendingAmount)} pending + ` : ""}your ledger. Reconciled against every transaction.`, parts: [["Posted", sgd(a.postedBalance)], ["Available", sgd(a.availableBalance)], ["Pending", sgd(a.pendingAmount)]] })}
            >
              {a.isLiability ? `− ${sgd(a.postedBalance)}` : sgd(a.postedBalance)} <span className={slice.explainMark} aria-hidden>ⓘ</span>
            </button>
          </li>
        ))}
      </ul>

      {(nextIn || nextBill) && (
        <p className={styles.nextMoment}>
          {nextIn ? `Next income: ${sgd(nextIn.amount)} in ${nextIn.inDays} day${nextIn.inDays === 1 ? "" : "s"}. ` : ""}
          {nextBill ? `Next bill: ${nextBill.label} ${sgd(nextBill.amount)} on ${nextBill.dueDate}.` : ""}
        </p>
      )}

      <p className={styles.sectionTitle}>Recent transactions</p>
      {txns.length === 0 ? (
        <p className={styles.provenance}>No transactions yet — import a statement to fill this in.</p>
      ) : (
        <ul className={styles.txnList}>
          {txns.slice(0, 6).map((tx) => (
            <li key={tx.id} className={styles.txnRow}>
              <span>
                <span className={styles.txnMerchant}>{tx.merchant || tx.category || tx.channel || "Payment"}</span>
                <span className={styles.txnMeta}> {tx.status !== "posted" ? tx.status : ""}</span>
              </span>
              <span className={`${styles.txnAmt} ${tx.direction === "credit" ? styles.txnIn : ""}`}>
                {tx.direction === "credit" ? "+" : "−"} {sgd(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={styles.primaryBtn} onClick={onNext} style={{ marginTop: 14 }}>
        See what matters next
      </button>
    </section>
  );
}

// 4 - Explore (curated, not a directory) -----------------------
function Explore({ twin, onHome, onProblem, onBack }) {
  const rescue = twin?.rescueCases?.[0] ?? null;
  const hasTxns = (twin?.recentTransactions ?? []).length > 0;
  const recommended = rescue
    ? { title: rescue.whatHappened, why: rescue.whyItMatters, next: rescue.options?.[0]?.label ?? "See the options", onClick: onProblem, cta: "Look at this" }
    : !hasTxns
      ? { title: "Import your transactions", why: "Your picture is thin without them — spending, bills and Safe-to-Spend all get sharper.", next: "Upload a CSV statement", onClick: onBack, cta: "Import now" }
      : { title: "Start with a life goal", why: "You have the basics in place. See how a real plan sits against your money.", next: "Answer 2 quick questions", onClick: onHome, cta: "Build a future" };

  return (
    <section aria-labelledby="fb-explore">
      <button type="button" className={styles.ghostBtn} onClick={onBack} style={{ alignSelf: "flex-start" }}>
        ← Today
      </button>
      <h1 id="fb-explore" className={slice.h1}>What matters next</h1>

      <div className={slice.recommend}>
        <span className={styles.rippleState}>Recommended for you</span>
        <strong>{recommended.title}</strong>
        <span className={styles.txnMeta}>Why now: {recommended.why}</span>
        <span className={styles.txnMeta}>Next: {recommended.next}</span>
        <button type="button" className={styles.primaryBtn} onClick={recommended.onClick} style={{ marginTop: 6 }}>
          {recommended.cta}
        </button>
      </div>

      <div className={styles.choiceList} style={{ marginTop: 12 }}>
        <button type="button" className={styles.choiceBtn} onClick={onProblem}>
          <span className={styles.choiceName}>Fix a money problem</span>
          <span className={styles.choiceHint}>A payment, a bill, a tight month, an unfamiliar charge.</span>
        </button>
        <button type="button" className={styles.choiceBtn} onClick={onHome}>
          <span className={styles.choiceName}>Plan a home</span>
          <span className={styles.choiceHint}>Plan a home, and see the cost to your other goals.</span>
        </button>
      </div>

      <details className={slice.allServices}>
        <summary>See all services</summary>
        <p className={styles.provenance}>
          The full set of Future Bank capabilities — accounts, transfers, spending insight, the nine life Studios, Guardian and history — lives in the main app.
          Some need a bank connection that isn't wired yet; those are shown honestly, never as working buttons.
        </p>
      </details>
    </section>
  );
}

// 5 + 6 - Home goal + Change Receipt --------------------------
const PRICE_BANDS = [
  { id: "under-400k", label: "Under 400k" },
  { id: "400k-600k", label: "400k–600k" },
  { id: "600k-900k", label: "600k–900k" },
  { id: "900k-1.4m", label: "900k–1.4m" },
  { id: "over-1.4m", label: "Over 1.4m" },
];
function monthChoices(n = 8) {
  const out = [];
  const now = new Date();
  for (let i = 1; i <= n; i += 1) {
    const d = new Date(now.getFullYear() + i, now.getMonth(), 1);
    out.push({ id: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${d.getFullYear()}` });
  }
  return out;
}

function HomeGoal({ onBack, onReceipt }) {
  const [priceBand, setPriceBand] = useState("");
  const [month, setMonth] = useState("");
  const [phase, setPhase] = useState("ask"); // ask | path | receipt
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [path, setPath] = useState(null);
  const [before, setBefore] = useState(null);
  const [monthly, setMonthly] = useState("");
  const [monthlyErr, setMonthlyErr] = useState("");

  const loadPath = useCallback(async () => {
    const r = await fetch("/api/future-field?domain=home", { headers: { "cache-control": "no-cache" } });
    const d = await r.json();
    return d;
  }, []);

  const seed = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/future-field/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: "home", mode: "estimate", answers: { price_band: priceBand, target_month: month } }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error === "missing_answers" ? "Pick a price band and a year first." : "Could not build your path.");
        return;
      }
      const field = await loadPath();
      setPath(field);
      setBefore(summarise(field));
      setPhase("path");
    } finally {
      setBusy(false);
    }
  };

  const applyChange = async () => {
    const parsed = parseMoneyInput(monthly, { min: 1 });
    if (!parsed.ok) {
      setMonthlyErr(parsed.error);
      return;
    }
    setMonthlyErr("");
    setBusy(true);
    try {
      // persist the changed assumption as a new plan version (real server compute)
      const res = await fetch("/api/future-field/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: "home", mode: "estimate", answers: { price_band: priceBand, target_month: month }, exactAmounts: { monthly_contribution: parsed.value } }),
      });
      if (!res.ok) {
        setErr("Could not save your change.");
        return;
      }
      const field = await loadPath();
      setPath(field);
      setPhase("receipt");
      onReceipt?.();
    } finally {
      setBusy(false);
    }
  };

  const after = path ? summarise(path) : null;

  return (
    <section aria-labelledby="fb-home">
      <button type="button" className={styles.ghostBtn} onClick={onBack} style={{ alignSelf: "flex-start" }}>
        ← What matters next
      </button>
      <h1 id="fb-home" className={slice.h1}>Your first home path</h1>

      {phase === "ask" && (
        <>
          <p className={styles.provenance}>Two questions. You can refine everything afterwards.</p>
          <fieldset className={styles.gSection} style={{ border: 0, padding: 0 }}>
            <legend className={styles.gSectionTitle}>Roughly what price range?</legend>
            <div className={styles.choiceList} style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {PRICE_BANDS.map((b) => (
                <button key={b.id} type="button" className={styles.choiceBtn} style={{ flex: "1 1 40%" }} aria-pressed={priceBand === b.id} onClick={() => setPriceBand(b.id)}>
                  <span className={styles.choiceName}>{b.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className={styles.field}>
            <span>Around which year would you like to buy?</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">— choose —</option>
              {monthChoices().map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {err ? <p className={styles.fieldError} role="alert">{err}</p> : null}
          <button type="button" className={styles.primaryBtn} disabled={busy || !priceBand || !month} onClick={seed}>
            {busy ? "Working…" : "Show my first path"}
          </button>
        </>
      )}

      {(phase === "path" || phase === "receipt") && after && (
        <>
          <div className={slice.recommend}>
            <span className={styles.rippleState}>Here is your first path</span>
            <strong>
              {after.readyMonth ? `On track for around ${after.readyMonth}` : "Set a monthly amount to get a target date"}
            </strong>
            <span className={styles.txnMeta}>
              Built from your price range and target year. Property type is estimated for now — you can refine it later.
              This changes your monthly saving pace and your safety buffer.
            </span>
          </div>

          {phase === "path" && (
            <div className={styles.gSection}>
              <p className={styles.gSectionTitle}>Change one assumption</p>
              <label className={styles.field}>
                <span>What could you set aside each month?</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={monthly}
                  placeholder="e.g. 1,500"
                  onChange={(e) => setMonthly(e.target.value)}
                  onBlur={(e) => {
                    const p = parseMoneyInput(e.target.value, { min: 0 });
                    if (p.ok) setMonthly(formatMoney(p.value));
                  }}
                  aria-invalid={Boolean(monthlyErr)}
                />
                {monthlyErr ? <span className={styles.fieldError}>{monthlyErr}</span> : null}
              </label>
              <button type="button" className={styles.primaryBtn} disabled={busy} onClick={applyChange}>
                {busy ? "Saving…" : "Apply this change"}
              </button>
            </div>
          )}

          {phase === "receipt" && (
            <div className={slice.receipt} role="status">
              <p className={styles.gSectionTitle}>What changed</p>
              <p>
                You set a monthly amount of <strong>{after.monthly ? sgd(after.monthly) : "—"}</strong>.
              </p>
              <p>
                Your monthly saving pace →{" "}
                <strong>{after.monthly ? sgd(after.monthly) : "—"}/mo</strong>
                {before?.monthly != null && before.monthly !== after.monthly ? ` (was ${sgd(before.monthly)})` : ""}.
              </p>
              <p>
                Your timeline →{" "}
                <strong>{after.readyMonth ?? "not yet reachable"}</strong>
                {before?.readyMonth && before.readyMonth !== after.readyMonth ? ` (was ${before.readyMonth})` : ""}.
              </p>
              <p className={styles.provenance}>
                {path?.realityPath?.sealableVerdict?.sealable
                  ? "This path is ready to lock in when you are."
                  : `Not lockable yet: ${path?.realityPath?.sealableVerdict?.reason ?? "some details still needed"}.`}
              </p>
              <button type="button" className={styles.primaryBtn} onClick={onBack}>
                Back to what matters next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function summarise(field) {
  const rp = field?.realityPath ?? {};
  return {
    monthly: rp.monthlyContribution ?? rp.data?.monthly_contribution ?? null,
    readyMonth: rp.readyMonth ?? null,
    monthsToReady: rp.monthsToReady ?? null,
  };
}

// Explain sheet -----------------------------------------------
function ExplainSheet({ item, onClose }) {
  return (
    <div className={slice.sheet} role="dialog" aria-modal="true" aria-label={`How ${item.label} is worked out`}>
      <div className={slice.sheetInner}>
        <p className={styles.gSectionTitle}>{item.label} — {item.value}</p>
        <p>{item.how}</p>
        {item.parts?.length ? (
          <ul className={styles.gList}>
            {item.parts.map(([k, v], i) => (
              <li key={i}>
                {k}: {v}
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.provenance}>Figures are computed on the server from your real data, not estimated here.</p>
        <button type="button" className={styles.primaryBtn} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
