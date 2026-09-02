"use client";

// Future Bank - the primary authenticated experience. "Money Current" is
// the through-line: real money events flow through time; you see what is
// safe now, what arrives next, what is spoken for, and how one decision
// ripples that current.
//
//   Welcome -> Money Snapshot (3 steps) -> Today (the front door)
//   Today: Money Position -> Bank Now -> Money Current -> One thing that
//          needs you -> What changed -> Plans in motion -> Recent activity
//   Explore ("What needs you next"): Future Bank noticed / plans moving /
//          choose what to do
//   + Home Horizon, Guardian, History
//
// All product truth comes from FutureBankDataProvider (twin + money-moments
// + life-thread + ripple + ledger, refreshed together). No page-local
// calculations.

import { useCallback, useEffect, useState } from "react";
import css from "./fb.module.css";
import { MoneyCurrent } from "./MoneyCurrent.jsx";
import { parseMoneyInput, formatMoney } from "../../lib/money-input.js";
import { FutureBankDataProvider, useFutureBankData } from "../components/future-bank/FutureBankDataProvider.jsx";
import { BankNowActions } from "../components/future-bank/BankNowActions.jsx";
import { DetectedMoments } from "../components/future-bank/DetectedMoments.jsx";
import { MoneyChangedReceipt } from "../components/future-bank/MoneyChangedReceipt.jsx";
import { ActivePlanRail } from "../components/future-bank/ActivePlanRail.jsx";
import { ChangeReceipt } from "../components/future-bank/ChangeReceipt.jsx";
import { relTime, humanMetric, isMaterial } from "../components/future-bank/format.js";
import fbc from "../components/future-bank/future-bank.module.css";

const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
const POST = (url, body) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) =>
    r.json().then((j) => ({ ok: r.ok, status: r.status, ...j })),
  );

export function FutureBankSlice({ onExitToApp = null }) {
  const [auth, setAuth] = useState("checking");
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuth(d?.id ? "in" : "anon"))
      .catch(() => setAuth("anon"));
  }, []);

  if (auth === "checking") return <Shell><p className={css.lede}>Opening Future Bank…</p></Shell>;
  if (auth === "anon")
    return (
      <Shell>
        <p className={css.kicker}>Future Bank</p>
        <h1 className={css.title}>Sign in to continue</h1>
        <p className={css.lede}>
          This preview uses a real account. <a className={css.link} href="/signup">Create one</a> or{" "}
          <a className={css.link} href="/login">sign in</a>, then return here.
        </p>
      </Shell>
    );

  return (
    <FutureBankDataProvider enabled>
      <SliceInner onExitToApp={onExitToApp} />
    </FutureBankDataProvider>
  );
}

function SliceInner({ onExitToApp }) {
  const fb = useFutureBankData();
  const [step, setStep] = useState("welcome");
  const [returnTo, setReturnTo] = useState("today");
  const [sheet, setSheet] = useState(null);

  const twin = fb.twin;
  const partial = twin && (twin.isEmpty || (twin.counts && twin.counts.incomeStreams === 0));

  // route strings from MoneyMoment.nextActions / plan actions -> a step
  const routeTo = useCallback((route) => {
    const r = String(route || "");
    if (r.startsWith("studio:") || r === "home") {
      setReturnTo("today");
      setStep("home");
    } else if (r === "history") setStep("history");
    else if (r === "guardian") setStep("guardian");
    else if (r === "snapshot") setStep("snapshot");
    else if (r === "explore" || r === "explore:plans") setStep("needs");
    else if (r === "today" || r === "today:activity") setStep("today");
    else setStep("needs");
  }, []);

  // On first data load, land on Today if the user already has a picture.
  useEffect(() => {
    if (step === "welcome" && twin && !twin.isEmpty) setStep("today");
  }, [twin, step]);

  return (
    <Shell>
      {step === "welcome" && (
        <Welcome onStart={() => setStep(twin && !twin.isEmpty ? "today" : "snapshot")} onData={() => setSheet({ kind: "data" })} />
      )}
      {step === "snapshot" && (
        <MoneySnapshot onDone={() => { fb.refetchAll(); setStep("today"); }} onExplore={() => setStep("needs")} />
      )}
      {step === "complete" && <CompletePicture onDone={() => { fb.refetchAll(); setStep("today"); }} />}

      {step === "today" && (
        <Today
          fb={fb}
          partial={partial}
          onExplain={(k) => setSheet({ kind: k, twin })}
          onNext={() => setStep("needs")}
          onAddSource={() => setStep("snapshot")}
          onComplete={() => setStep("complete")}
          onBank={(k) => setSheet({ kind: k })}
          onRoute={routeTo}
        />
      )}

      {step === "needs" && (
        <NeedsNext
          fb={fb}
          onBack={() => setStep("today")}
          onHome={() => { setReturnTo("needs"); setStep("home"); }}
          onSnapshot={() => setStep("snapshot")}
          onProblem={() => setSheet({ kind: "problem", twin })}
          onServices={() => setSheet({ kind: "services" })}
          onRoute={routeTo}
        />
      )}

      {step === "home" && (
        <HomeHorizon
          fb={fb}
          onBack={() => setStep(returnTo)}
          onDone={() => fb.refetchAll()}
          onHistory={() => setStep("history")}
        />
      )}

      {step === "guardian" && <GuardianView fb={fb} onBack={() => setStep("today")} onRoute={routeTo} />}
      {step === "history" && <HistoryView fb={fb} onBack={() => setStep("today")} />}

      {sheet && (
        <BottomSheet
          sheet={sheet}
          fb={fb}
          onClose={() => setSheet(null)}
          onGoHome={() => { setSheet(null); setReturnTo("today"); setStep("home"); }}
          onGoSnapshot={() => { setSheet(null); setStep("snapshot"); }}
          onRoute={(r) => { setSheet(null); routeTo(r); }}
        />
      )}

      {onExitToApp ? (
        <button type="button" className={css.backLink} style={{ opacity: 0.5 }} onClick={onExitToApp}>
          Switch to the classic app
        </button>
      ) : null}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className={css.app}>
      <div className={css.shell}>
        {children}
        <p className={css.footer}>
          Every figure traces to your ledger or a range you chose. Your data stays on your account and is never shared.
        </p>
      </div>
    </div>
  );
}

/* ================= A. Welcome ================= */
function Welcome({ onStart, onData }) {
  return (
    <div className={css.welcomeWrap}>
      <div>
        <p className={css.kicker}>Future Bank</p>
        <h1 className={css.display}>Your money has a present. It also has a direction.</h1>
      </div>
      <div className={css.welcomeArt}>
        <MoneyCurrent twin={welcomePreviewTwin} compact />
        <p className={css.micro} style={{ marginTop: 10 }}>A worked example — yours is built from your own accounts.</p>
      </div>
      <ul className={css.proofList}>
        <li><span className={css.proofMark}>→</span> Know what is safe to spend now.</li>
        <li><span className={css.proofMark}>→</span> See the trade-offs before you commit.</li>
        <li><span className={css.proofMark}>→</span> Keep plans connected to real life.</li>
      </ul>
      <div>
        <button type="button" className={css.cta} onClick={onStart}>Build my money picture</button>
        <button type="button" className={css.link} style={{ marginTop: 10 }} onClick={onData}>How does this use my data?</button>
      </div>
    </div>
  );
}
const welcomePreviewTwin = {
  safeToSpend: { safeToSpend: 2400, breakdown: { protectedReserve: 3000 }, nextIncome: { amount: 4200, inDays: 9, label: "Salary" }, nearTermObligationsList: [{ amount: 1450, dueDate: null, label: "Rent" }] },
};

/* ================= B. Money Snapshot (3 steps) ================= */
function MoneySnapshot({ onDone, onExplore }) {
  const [n, setN] = useState(1);
  const [begin, setBegin] = useState("");
  const [nickname, setNickname] = useState("");
  const [bank, setBank] = useState("");
  const [balance, setBalance] = useState("");
  const [balErr, setBalErr] = useState("");
  const [watch, setWatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const beginOpts = [
    { id: "current", label: "A current account", hint: "Everyday spending money." },
    { id: "savings", label: "A savings account", hint: "Money you're setting aside." },
    { id: "import", label: "Import a statement", hint: "Upload a CSV of transactions." },
    { id: "goal", label: "Just explore a goal first", hint: "See a plan before adding accounts." },
  ];

  const submitAccount = async () => {
    if (begin === "goal") return onExplore();
    if (begin === "import") return setN(9);
    const parsed = balance ? parseMoneyInput(balance, { min: 0 }) : { ok: true, value: 0 };
    if (!parsed.ok) return setBalErr(parsed.error);
    setBalErr("");
    setBusy(true);
    setErr("");
    try {
      const acc = await POST("/api/bank/accounts", { kind: begin, displayName: nickname || (begin === "savings" ? "Savings" : "Everyday"), institution: bank || undefined });
      if (!acc.ok) throw new Error(acc.error || "account");
      if (parsed.value > 0) {
        await POST("/api/bank/transactions", { accountId: acc.account.id, direction: "credit", amount: parsed.value, channel: "opening_balance", category: "opening_balance", merchant: "Opening balance" });
      }
      setN(3);
    } catch {
      setErr("Could not save that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitWatch = async () => {
    setBusy(true);
    try {
      if (watch === "income") {
        await POST("/api/financial-twin/rows", { kind: "income", data: { kind: "salary", label: "Salary", monthlyAmount: 0 } }).catch(() => {});
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  if (n === 9) {
    return (
      <>
        <StepHead n={2} of={3} onBack={() => setN(1)} title="Import a statement" />
        <p className={css.lede}>Upload a CSV export from your bank. You'll preview every row before anything is saved.</p>
        <CsvInline onDone={() => setN(3)} />
      </>
    );
  }

  return (
    <>
      <StepHead n={n} of={3} onBack={n > 1 ? () => setN(n - 1) : null} title={n === 1 ? "Where should we begin?" : n === 2 ? "Add this account" : "What should we watch first?"} />

      {n === 1 && (
        <div className={css.choiceGrid}>
          {beginOpts.map((o) => (
            <button
              key={o.id}
              type="button"
              className={css.choice}
              aria-pressed={begin === o.id}
              onClick={() => {
                setBegin(o.id);
                if (o.id === "goal") return onExplore();
                if (o.id === "import") return setN(9);
                setN(2);
              }}
            >
              <b>{o.label}</b>
              <span>{o.hint}</span>
            </button>
          ))}
        </div>
      )}

      {n === 2 && (
        <>
          <div className={css.field}>
            <label htmlFor="ms-nick">Nickname</label>
            <input id="ms-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={begin === "savings" ? "Savings" : "Everyday"} autoComplete="off" />
          </div>
          <div className={css.field}>
            <label htmlFor="ms-bal">Current balance</label>
            <input id="ms-bal" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} onBlur={(e) => { const p = parseMoneyInput(e.target.value, { min: 0 }); if (p.ok) setBalance(formatMoney(p.value)); }} placeholder="e.g. 4,200" />
            {balErr ? <span className={css.err}>{balErr}</span> : null}
          </div>
          <div className={css.field}>
            <label htmlFor="ms-bank">Bank (optional)</label>
            <input id="ms-bank" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="e.g. OCBC" autoComplete="off" />
          </div>
          {err ? <span className={css.err}>{err}</span> : null}
          <button type="button" className={css.cta} disabled={busy} onClick={submitAccount}>{busy ? "Saving…" : "Save account"}</button>
        </>
      )}

      {n === 3 && (
        <>
          <p className={css.lede}>Future Bank keeps an eye on one thing to start. You can add the rest any time.</p>
          <div className={css.choiceGrid}>
            {[
              { id: "bills", label: "My monthly bills", hint: "Rent, utilities, subscriptions." },
              { id: "income", label: "My income", hint: "When salary lands, and how much." },
              { id: "goal", label: "A future goal", hint: "A home, a wedding, a safety buffer." },
              { id: "nothing", label: "Nothing yet", hint: "Just show me where I stand." },
            ].map((o) => (
              <button key={o.id} type="button" className={css.choice} aria-pressed={watch === o.id} onClick={() => setWatch(o.id)}>
                <b>{o.label}</b>
                <span>{o.hint}</span>
              </button>
            ))}
          </div>
          <button type="button" className={css.cta} disabled={busy || !watch} onClick={submitWatch}>{busy ? "…" : "See my money picture"}</button>
        </>
      )}
    </>
  );
}

function StepHead({ n, of, onBack, title }) {
  return (
    <>
      {onBack ? <button type="button" className={css.backLink} onClick={onBack}>← Back</button> : <span />}
      <div className={css.stepDots}>
        {Array.from({ length: of }).map((_, i) => (
          <span key={i} className={`${css.stepDot} ${i < n ? css.on : ""}`} />
        ))}
      </div>
      <h1 className={css.title}>{title}</h1>
    </>
  );
}

function CsvInline({ onDone }) {
  const [accts, setAccts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch("/api/bank/accounts").then((r) => r.json()).then((d) => {
      setAccts(d.accounts ?? []);
      if (d.accounts?.[0]) setAccountId(d.accounts[0].id);
    });
  }, []);
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setMsg("File over 2 MB.");
    const rd = new FileReader();
    rd.onload = () => setCsv(String(rd.result ?? ""));
    rd.readAsText(f);
  };
  const doPreview = async () => {
    setBusy(true);
    const d = await POST("/api/import/transactions", { action: "preview", accountId, fileName: "import.csv", csv });
    setBusy(false);
    if (!d.ok) return setMsg(d.error ?? "Preview failed.");
    setPreview(d);
  };
  const doCommit = async () => {
    setBusy(true);
    const d = await POST("/api/import/transactions", { action: "commit", accountId, fileName: "import.csv", csv, mapping: preview.mapping });
    setBusy(false);
    if (!d.ok) return setMsg(d.error ?? "Import failed.");
    setMsg(`Imported ${d.imported}, skipped ${d.skippedDuplicates ?? 0} duplicates.`);
    setTimeout(onDone, 700);
  };
  if (accts.length === 0) return <p className={css.err}>Add an account first, then import into it.</p>;
  return (
    <>
      <div className={css.field}>
        <label htmlFor="csv-acc">Into account</label>
        <select id="csv-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accts.map((a) => <option key={a.id} value={a.id}>{a.displayName || a.kind}</option>)}
        </select>
      </div>
      <div className={css.field}>
        <label htmlFor="csv-file">CSV file (max 2 MB)</label>
        <input id="csv-file" type="file" accept=".csv,text/csv" onChange={onFile} />
      </div>
      {msg ? <span className={css.err}>{msg}</span> : null}
      {!preview ? (
        <button type="button" className={css.cta} disabled={busy || !csv} onClick={doPreview}>{busy ? "…" : "Preview"}</button>
      ) : (
        <>
          <p className={css.micro}>{preview.toImport} to import · {preview.duplicates} duplicates · {preview.invalidRows?.length ?? 0} invalid</p>
          <button type="button" className={css.cta} disabled={busy || !preview.toImport} onClick={doCommit}>{busy ? "…" : `Import ${preview.toImport}`}</button>
        </>
      )}
    </>
  );
}

/* ================= "Complete my picture" ================= */
function CompletePicture({ onDone }) {
  const [tab, setTab] = useState("income");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState("");
  const save = async () => {
    const p = parseMoneyInput(amount, { min: 0 });
    if (!p.ok) return setMsg(p.error);
    const data = tab === "income" ? { kind: "salary", label: label || "Salary", monthlyAmount: p.value } : { label: label || "Bill", monthlyAmount: p.value };
    const d = await POST("/api/financial-twin/rows", { kind: tab === "income" ? "income" : "recurring", data });
    setMsg(d.ok ? "Saved." : d.error ?? "Could not save.");
    if (d.ok) { setAmount(""); setLabel(""); }
  };
  return (
    <>
      <button type="button" className={css.backLink} onClick={onDone}>← Today</button>
      <h1 className={css.title}>Complete my picture</h1>
      <p className={css.lede}>Add income and recurring bills so Future Bank can see further ahead.</p>
      <div className={css.chipRow}>
        <button type="button" className={css.chip} aria-pressed={tab === "income"} onClick={() => setTab("income")}>Income</button>
        <button type="button" className={css.chip} aria-pressed={tab === "bill"} onClick={() => setTab("bill")}>Bill</button>
      </div>
      <div className={css.field}>
        <label htmlFor="cp-label">Name</label>
        <input id="cp-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tab === "income" ? "Salary" : "Rent"} autoComplete="off" />
      </div>
      <div className={css.field}>
        <label htmlFor="cp-amt">Monthly amount</label>
        <input id="cp-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={(e) => { const p = parseMoneyInput(e.target.value, { min: 0 }); if (p.ok) setAmount(formatMoney(p.value)); }} placeholder="e.g. 1,500" />
      </div>
      {msg ? <span className={css.err}>{msg}</span> : null}
      <button type="button" className={css.cta} onClick={save}>Add</button>
      <button type="button" className={css.link} onClick={onDone}>Done for now</button>
    </>
  );
}

/* ================= C. Today — the front door ================= */
function Today({ fb, partial, onExplain, onNext, onAddSource, onComplete, onBank, onRoute }) {
  const { twin, status } = fb;

  if ((status === "loading" || status === "idle") && !twin) return <p className={css.lede}>Loading your money…</p>;
  if (status === "error" && !twin)
    return (
      <>
        <p className={css.lede}>Your money picture didn't load.</p>
        <button type="button" className={css.cta} onClick={fb.refetchAll}>Try again</button>
      </>
    );

  if (!twin || twin.isEmpty) {
    return (
      <>
        <p className={css.kicker}>Today</p>
        <h1 className={css.title}>Your picture is empty</h1>
        <p className={css.lede}>Future Bank needs one real money source to begin. It stays saved to your account.</p>
        <button type="button" className={css.cta} onClick={onAddSource}>Add your first money source</button>
      </>
    );
  }

  const s2s = twin.safeToSpend ?? {};
  const bb = twin.twin?.balanceBreakdown ?? {};
  const committedMonthly = twin.twin?.committedMonthlyTotal ?? fb.resourceSummary?.committedMonthly ?? 0;
  const txns = (twin.recentTransactions ?? []).filter((t) => t.channel !== "opening_balance");
  const needsCount = fb.momentsRaw?.counts?.actionRequired ?? 0;
  const currentMoment = (fb.moments ?? []).find((m) => m.state === "new" && (m.severity === "action_required" || m.severity === "watch")) ?? null;
  const currentDecision = currentMoment
    ? {
        label: "Review",
        whenText: "needs you",
        effect: currentMoment.title,
        source: currentMoment.evidence?.[0]?.source ? `Future Bank · ${String(currentMoment.evidence[0].source).replace(/_/g, " ")}` : "Future Bank detection",
      }
    : null;

  return (
    <>
      <div>
        <p className={css.kicker}>Today · {new Date().toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className={css.micro}>Balances from your ledger · tap the amount, a state or the current to explain it</p>
      </div>

      {/* 1. MONEY POSITION */}
      <div className={css.bigAmountWrap}>
        <span className={css.bigAmountLabel}>Available now</span>
        <button
          type="button"
          className={`${css.bigAmount} ${s2s.belowProtectedFloor ? css.warn : ""}`}
          aria-label={`Available now, ${sgd(s2s.safeToSpend)}. Tap for how this is worked out.`}
          onClick={() => onExplain("available")}
        >
          {sgd(s2s.safeToSpend)} <span className={css.infoDot}>ⓘ</span>
        </button>
      </div>
      <div className={css.stateRow}>
        <button type="button" className={css.stateChip} onClick={() => onExplain("protected")}>
          <small className={css.dotProtected}>Protected</small>
          <b>{sgd(bb.protectedFor)}</b>
        </button>
        <button type="button" className={css.stateChip} onClick={() => onExplain("committed")}>
          <small className={css.dotSpoken}>Committed</small>
          <b>{sgd(committedMonthly)}<span className={css.perMo}> /mo</span></b>
        </button>
      </div>

      {/* 2. BANK NOW */}
      <BankNowActions
        onPayNow={() => onBank("paynow")}
        onFx={() => onBank("fx")}
        onScanPay={() => onBank("scanpay")}
      />

      {/* 3. MONEY CURRENT */}
      <MoneyCurrent twin={twin} decision={currentDecision} onExplain={() => onExplain("current")} detail />

      {/* 4. ONE THING THAT NEEDS YOU */}
      <section className={css.section}>
        <p className={css.kicker}>{needsCount > 0 ? `${needsCount} thing${needsCount > 1 ? "s" : ""} need${needsCount > 1 ? "" : "s"} you` : "One thing that needs you"}</p>
        <DetectedMoments limit={1} exclude={["turning_point"]} onRoute={onRoute} />
      </section>

      {/* 5. WHAT CHANGED SINCE YOU LAST OPENED */}
      <section className={css.section}>
        <p className={css.kicker}>What changed</p>
        <MoneyChangedReceipt onRoute={onRoute} onHistory={() => onRoute("history")} />
      </section>

      {/* 6. PLANS IN MOTION */}
      <section className={css.section}>
        <p className={css.kicker}>Plans in motion</p>
        <ActivePlanRail limit={3} dense onRoute={onRoute} />
      </section>

      {partial ? (
        <div className={css.partial}>
          <b>Your picture is still partial</b>
          <span>Add income and bills to see further ahead and get sharper guidance.</span>
          <button type="button" className={css.link} onClick={onComplete}>Complete my picture →</button>
        </div>
      ) : null}

      {/* 7. RECENT ACTIVITY */}
      <section className={css.section}>
        <p className={css.kicker}>Recent activity</p>
        {txns.length === 0 ? (
          <p className={css.micro}>No transactions yet — import a statement or add one to fill this in.</p>
        ) : (
          <div className={css.activity}>
            {txns.slice(0, 5).map((t) => (
              <div key={t.id} className={css.actItem}>
                <span className={`${css.actGlyph} ${t.direction === "debit" ? css.out : ""}`}>{(t.merchant || "?")[0].toUpperCase()}</span>
                <span className={css.actBody}>
                  <span className={css.actName}>{t.merchant || t.category || t.channel || "Payment"}</span>
                  <span className={css.actMeta}>{t.category ?? t.channel ?? ""}{t.status !== "posted" ? ` · ${t.status}` : ""}</span>
                </span>
                <span className={`${css.actAmt} ${t.direction === "credit" ? css.in : ""}`}>{t.direction === "credit" ? "+" : "−"} {sgd(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" className={css.link} onClick={() => onRoute("today:activity")}>View all activity →</button>
      </section>

      <button type="button" className={css.cta} onClick={onNext}>See what needs you next</button>
    </>
  );
}

/* ================= D. What needs you next (Explore) ================= */
function NeedsNext({ fb, onBack, onHome, onSnapshot, onProblem, onServices, onRoute }) {
  const partial = fb.twin && (fb.twin.isEmpty || (fb.twin.counts && fb.twin.counts.incomeStreams === 0));
  const hasTxns = (fb.twin?.recentTransactions ?? []).some((t) => t.channel !== "opening_balance");

  let rec;
  if (fb.moments.length > 0) {
    const m = fb.moments[0];
    rec = { title: m.title, why: m.whyNow || m.summary, next: m.nextActions?.[0]?.label ?? "Review it", cta: "Look at this", onClick: () => onRoute(m.nextActions?.[0]?.route || "today") };
  } else if (partial) {
    rec = { title: "Make your picture sharper", why: "Future Bank can't see far ahead without your income and bills.", next: "Add them in a minute", cta: "Complete my picture", onClick: onSnapshot };
  } else if (!hasTxns) {
    rec = { title: "Bring in your transactions", why: "Spending, bills and Safe-to-Spend all get sharper with real history.", next: "Import a CSV statement", cta: "Import now", onClick: onSnapshot };
  } else {
    rec = { title: "Shape a home plan", why: "You have the basics. See how a real plan sits against your money.", next: "Answer 2 quick questions", cta: "Start", onClick: onHome };
  }

  return (
    <>
      <button type="button" className={css.backLink} onClick={onBack}>← Today</button>
      <h1 className={css.title}>What needs you next</h1>

      {/* Layer 1 — Future Bank noticed */}
      <section className={css.section}>
        <div className={css.sectionHead}>
          <p className={css.kicker}>Future Bank noticed</p>
          {fb.moments.length ? <span className={css.sectionCount}>{fb.moments.length}</span> : null}
        </div>
        <DetectedMoments limit={3} onRoute={onRoute} />
      </section>

      {/* Layer 2 — Your plans are moving */}
      <section className={css.section}>
        <p className={css.kicker}>Your plans are moving</p>
        <ActivePlanRail limit={6} dense={false} onRoute={onRoute} />
      </section>

      {/* Layer 3 — Choose what to do */}
      <section className={css.section}>
        <p className={css.kicker}>Choose what to do</p>
        <div className={css.ripple} style={{ borderLeft: "3px solid var(--sea)" }}>
          <p className={css.kicker}>Recommended</p>
          <b style={{ fontSize: 16 }}>{rec.title}</b>
          <span className={css.micro}>Why now: {rec.why}</span>
          <span className={css.micro}>Next: {rec.next}</span>
          <button type="button" className={`${css.cta} ${css.ctaSea}`} onClick={rec.onClick} style={{ marginTop: 4 }}>{rec.cta}</button>
        </div>
        <div className={css.choiceGrid}>
          <button type="button" className={css.choice} onClick={onBack}><b>Understand my money</b><span>Where it goes, what's recurring, what changed.</span></button>
          <button type="button" className={css.choice} onClick={onProblem}><b>Solve a problem</b><span>A payment, a bill, a tight month, an unfamiliar charge.</span></button>
          <button type="button" className={css.choice} onClick={onHome}><b>Build a future</b><span>Plan a home and see the cost to your other goals.</span></button>
        </div>
        <button type="button" className={css.link} onClick={onServices}>All services</button>
      </section>
    </>
  );
}

/* ================= E. Home Horizon + Change Receipt ================= */
const PRICE_BANDS = [
  { id: "under-400k", label: "Under 400k", mid: 350000 },
  { id: "400k-600k", label: "400–600k", mid: 500000 },
  { id: "600k-900k", label: "600–900k", mid: 750000 },
  { id: "900k-1.4m", label: "900k–1.4m", mid: 1150000 },
  { id: "over-1.4m", label: "Over 1.4m", mid: 1650000 },
];
function yearChoices() {
  const y = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => `${y + i + 1}`);
}
const humanSealBlock = (reason) => {
  if (!reason) return null;
  if (/regulatory_ceiling|exceeds/.test(reason)) return "This path needs a later target, a lower price, or more monthly room before it can become a commitment.";
  if (/estimate_needs_confirmation/.test(reason)) return "Confirm the estimated details before this can become a commitment.";
  return "A few details are still needed before this can become a commitment.";
};

function HomeHorizon({ fb, onBack, onDone, onHistory }) {
  const [band, setBand] = useState("");
  const [year, setYear] = useState("");
  const [phase, setPhase] = useState("ask");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [path, setPath] = useState(null);
  const [before, setBefore] = useState(null);
  const [pace, setPace] = useState(1000);

  const loadPath = useCallback(() => fetch("/api/future-field?domain=home", { headers: { "cache-control": "no-cache" } }).then((r) => r.json()), []);

  const seed = async (extra = {}) => {
    setBusy(true);
    setErr("");
    const d = await POST("/api/future-field/seed", { domain: "home", mode: "estimate", answers: { price_band: band, target_month: `${year}-01` }, exactAmounts: extra });
    if (!d.ok) {
      setBusy(false);
      setErr(d.error === "missing_answers" ? "Pick a price range and a year." : "Could not build your path.");
      return null;
    }
    const field = await loadPath();
    setBusy(false);
    return field;
  };

  const start = async () => {
    const field = await seed();
    if (!field) return;
    setPath(field);
    setBefore(summarise(field));
    setPhase("shape");
  };

  const apply = async () => {
    const field = await seed({ monthly_contribution: pace });
    if (!field) return;
    const v = field?.realityPath?.sealableVerdict;
    if (v && v.sealable === false && process.env.NODE_ENV !== "production") {
      console.warn(`[FutureBank] Home path not yet sealable — server reason: ${v.reason}`);
    }
    setPath(field);
    setPhase("receipt");
    onDone?.();
  };

  const after = path ? summarise(path) : null;
  const priceMid = PRICE_BANDS.find((b) => b.id === band)?.mid ?? null;

  // Every materially affected plan/goal - server-sourced only. Committing
  // this pace is that much less monthly room for every other plan (Life
  // Thread resourceSummary); the home window is the projector's; plus any
  // projector cross-goal row that actually moves.
  const rs = fb.resourceSummary ?? {};
  const paceNow = after?.monthly ?? pace;
  const roomBefore = rs.remainingMonthlyRoom;
  const affected = [
    {
      domain: "all plans", metric: "possible monthly plan load", unit: "sgd_per_month",
      before: rs.committedMonthly ?? 0, possibleAfter: (rs.committedMonthly ?? 0) + paceNow,
      direction: "up", favourable: false,
    },
    roomBefore != null
      ? { domain: "your budget", metric: "remaining monthly room", unit: "sgd_per_month", before: roomBefore, possibleAfter: roomBefore - paceNow, direction: "down", favourable: false }
      : { domain: "your budget", metric: "remaining monthly room", unit: "sgd_per_month", before: null, possibleAfter: null, direction: "flat" },
    {
      domain: "home", metric: "ready window", unit: "qualitative",
      before: before?.readyMonth ?? "unset", possibleAfter: after?.readyMonth ?? "not yet reachable", direction: "flat",
    },
    ...affectedFromField(path).filter(isMaterial),
  ];

  return (
    <>
      <button type="button" className={css.backLink} onClick={onBack}>← Back</button>
      <h1 className={css.title}>Home Horizon</h1>

      {phase === "ask" && (
        <>
          <p className={css.lede}>Two things to start. Everything is adjustable afterwards.</p>
          <div className={css.field}>
            <label>Price range</label>
            <div className={css.chipRow}>
              {PRICE_BANDS.map((b) => (
                <button key={b.id} type="button" className={css.chip} aria-pressed={band === b.id} onClick={() => setBand(b.id)}>{b.label}</button>
              ))}
            </div>
          </div>
          <div className={css.field}>
            <label htmlFor="hh-year">Target year</label>
            <select id="hh-year" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">— choose —</option>
              {yearChoices().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {err ? <span className={css.err}>{err}</span> : null}
          <button type="button" className={css.cta} disabled={busy || !band || !year} onClick={start}>{busy ? "Working…" : "Show my horizon"}</button>
        </>
      )}

      {(phase === "shape" || phase === "receipt") && after && (
        <>
          <div className={css.horizon}>
            <p className={css.kicker}>Your path to this home</p>
            <div className={css.horizonTrack}>
              <div className={css.horizonBase} />
              <div className={css.horizonFill} style={{ width: after.readyMonth ? "72%" : "22%" }} />
              <div className={css.horizonEnd} style={{ left: after.readyMonth ? "72%" : "22%" }}>
                <b>{after.readyMonth ?? "not reachable"}</b>
                <small>{after.readyMonth ? "on this pace" : "at this pace"}</small>
              </div>
              <div className={css.horizonFloor}>Safety floor — protected buffer stays covered</div>
            </div>
            <div className={css.horizonRange}>
              <span>Today</span>
              <span>{priceMid ? sgd(priceMid) : ""} home · {year}</span>
            </div>
          </div>

          {phase === "shape" && (
            <>
              {affected.length > 0 && (
                <div className={css.section}>
                  <p className={css.kicker}>If you apply this — preview effect on other plans</p>
                  <div className={css.horizonRange} />
                  <PreviewAffected affected={affected} />
                </div>
              )}
              <div className={css.field}>
                <label htmlFor="hh-pace">Monthly pace: <b>{sgd(pace)}</b></label>
                <input id="hh-pace" className={css.slider} type="range" min={200} max={6000} step={100} value={pace} onChange={(e) => setPace(Number(e.target.value))} />
              </div>
              <p className={css.micro}>
                {after.monthsToReady != null
                  ? `Around SGD ${pace.toLocaleString("en-SG")} a month puts your home window near ${projectYear(year, pace, priceMid)}.`
                  : "Set a pace to see a target window."}
              </p>
              <button type="button" className={css.cta} disabled={busy} onClick={apply}>{busy ? "Saving…" : "Apply this pace"}</button>
            </>
          )}

          {phase === "receipt" && (
            <ChangeReceipt
              before={`Monthly pace ${before?.monthly ? sgd(before.monthly) : "SGD 0"} · window ${before?.readyMonth ?? "unset"}`}
              changed={`Set aside ${sgd(after.monthly ?? pace)} each month toward a home`}
              after={`Monthly pace ${sgd(after.monthly ?? pace)} · window ${after.readyMonth ?? "not yet reachable"}`}
              monthlyAdded={after.monthly ?? pace}
              affected={affected}
              committed={false}
              humanReason={
                path?.realityPath?.sealableVerdict?.sealable
                  ? null
                  : humanSealBlock(path?.realityPath?.sealableVerdict?.reason)
              }
              guardianResponse={
                fb.momentsRaw?.moments?.some((m) => m.sourceType === "turning_point")
                  ? "Guardian sees a turning point ahead — review it before sealing."
                  : "Guardian has no objection to this preview."
              }
              nextAction={{ label: "Back to what needs you next", onClick: onBack }}
              onHistory={onHistory}
            />
          )}
          <p className={css.micro}>
            Built from your price range and target year (a range you chose). Property type is estimated for now — refine it later.
          </p>
        </>
      )}
    </>
  );
}

function PreviewAffected({ affected }) {
  const rows = affected.filter(isMaterial);
  if (rows.length === 0) return <p className={css.micro}>No other plan is materially affected by this pace.</p>;
  return (
    <div className={css.horizon}>
      {rows.map((a, i) => (
        <div key={i} className={css.horizonRange}>
          <span style={{ textTransform: "capitalize" }}>{String(a.domain).replace(/_/g, " ")} · {humanMetric(a.metric)}</span>
          <span>
            {a.before != null ? `${a.before} → ` : ""}
            {a.possibleAfter != null ? a.possibleAfter : "Needs more information"}
            {" "}
            <b style={{ color: "var(--amber)" }}>Preview</b>
          </span>
        </div>
      ))}
    </div>
  );
}

// Every materially affected plan/goal from the server-computed impacts of
// the seeded home path. `projectImpacts` returns an object whose
// `affectedGoals` array is what we render - each row keeps its own unit.
function affectedFromField(field) {
  const paths = field?.possiblePaths ?? [];
  let src = [];
  for (const p of paths) {
    const pi = p.projectedImpacts;
    const goals = Array.isArray(pi) ? pi : Array.isArray(pi?.affectedGoals) ? pi.affectedGoals : null;
    if (goals && goals.length) {
      src = goals;
      break;
    }
  }
  return src
    .filter((g) => g && (g.goalId || g.domain) && g.metric && (g.before != null || g.possibleAfter != null || g.after != null))
    .map((g) => ({
      domain: g.goalId ?? g.domain,
      metric: g.metric,
      unit: g.unit ?? (typeof g.possibleAfter === "number" && Math.abs(g.possibleAfter) <= 12 && /month|shift|buffer/i.test(g.metric) ? "months" : "qualitative"),
      before: g.before ?? null,
      possibleAfter: g.possibleAfter ?? g.after ?? null,
      confirmedAfter: g.confirmedAfter ?? null,
      direction: g.direction ?? (g.before != null && g.possibleAfter != null ? (g.possibleAfter > g.before ? "up" : g.possibleAfter < g.before ? "down" : "flat") : "flat"),
      favourable: g.favourable ?? null,
    }));
}

function summarise(field) {
  const rp = field?.realityPath ?? {};
  return { monthly: rp.monthlyContribution ?? rp.data?.monthly_contribution ?? null, readyMonth: rp.readyMonth ?? null, monthsToReady: rp.monthsToReady ?? null };
}
function projectYear(year, pace, priceMid) {
  if (!priceMid || !pace) return year;
  const need = priceMid * 0.25;
  const months = Math.ceil(need / pace);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.getFullYear();
}

/* ================= Guardian ================= */
// Guardian consumes the SAME MoneyMoment objects as Today and Explore -
// no separate lifeThread.guardianDecision alert model, no raw i18n keys.
function GuardianView({ fb, onBack, onRoute }) {
  const moments = fb.momentsRaw?.allMoments ?? fb.moments ?? [];
  const watch = moments.filter((m) => (m.severity === "action_required" || m.severity === "watch") && m.state === "new");
  const decision = watch.find((m) => m.sourceType === "turning_point") ?? watch[0] ?? null;
  const watching = decision ? watch.filter((m) => m.id !== decision.id) : watch;

  return (
    <>
      <button type="button" className={css.backLink} onClick={onBack}>← Today</button>
      <h1 className={css.title}>Guardian</h1>
      <p className={css.micro}>Guardian reads the same Money Moments as Today and Explore — one model, no separate alert list.</p>

      {decision ? (
        <div className={fbc.moment} style={{ borderLeftColor: "var(--amber)" }}>
          <div className={fbc.momentTitle}>{decision.sourceType === "turning_point" ? "A decision is waiting" : decision.title}</div>
          <div className={fbc.momentSummary}>{decision.summary}</div>
          <button
            type="button"
            className={`${fbc.act} ${fbc.primary}`}
            onClick={() => onRoute(decision.nextActions?.[0]?.route || "home")}
          >
            {decision.nextActions?.[0]?.label ?? "Review the plan"}
          </button>
        </div>
      ) : (
        <div className={fbc.calm}>
          <span className={fbc.calmTitle}>Guardian has no decision waiting.</span>
          <span className={fbc.empty}>It is watching {watch.length} item{watch.length === 1 ? "" : "s"} on your behalf.</span>
        </div>
      )}

      <p className={css.kicker}>Watching now</p>
      {watching.length === 0 ? (
        <p className={css.micro}>Nothing on watch.</p>
      ) : (
        <div className={fbc.section}>
          {watching.slice(0, 5).map((m) => (
            <div key={m.id} className={`${fbc.moment} ${fbc[m.severity] || ""}`}>
              <div className={fbc.momentTop}>
                <span className={`${fbc.sev} ${fbc[m.severity] || ""}`}>{String(m.severity).replace("_", " ")}</span>
                <span className={fbc.evMeta} style={{ marginLeft: "auto" }}>{m.state}</span>
              </div>
              <div className={fbc.momentTitle}>{m.title}</div>
              {m.nextActions?.[0] ? (
                <button type="button" className={fbc.act} disabled={m.nextActions[0].available === false} onClick={() => onRoute(m.nextActions[0].route || "today")}>
                  {m.nextActions[0].label}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ================= History ================= */
function HistoryView({ fb, onBack }) {
  const events = fb.ledger?.events ?? [];
  return (
    <>
      <button type="button" className={css.backLink} onClick={onBack}>← Today</button>
      <h1 className={css.title}>History</h1>
      <p className={css.micro}>Every confirmed change, newest first — the same causal record every Money Moment and receipt links to.</p>
      {events.length === 0 ? (
        <p className={css.micro}>No changes recorded yet.</p>
      ) : (
        <div className={css.activity}>
          {events.slice(0, 40).map((e) => (
            <div key={e.id} className={css.actItem}>
              <span className={css.actGlyph}>{(e.action_type || "?")[0].toUpperCase()}</span>
              <span className={css.actBody}>
                <span className={css.actName}>{(e.message_key || e.action_type || "change").replace(/[._]/g, " ")}</span>
                <span className={css.actMeta}>{e.status} · {e.source_feature} · {relTime(e.occurred_at)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ================= Bottom sheet ================= */
function BottomSheet({ sheet, fb, onClose, onGoHome, onGoSnapshot, onRoute }) {
  return (
    <div className={css.sheetScrim} onClick={onClose}>
      <div className={css.sheet} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <span className={css.sheetGrip} />
        {sheet.kind === "data" && <DataSheet />}
        {sheet.kind === "problem" && <ProblemSheet twin={sheet.twin} onGoHome={onGoHome} onGoSnapshot={onGoSnapshot} onClose={onClose} />}
        {sheet.kind === "services" && <ServicesSheet onRoute={onRoute} onClose={onClose} />}
        {sheet.kind === "paynow" && <PayNowSheet fb={fb} onClose={onClose} />}
        {sheet.kind === "fx" && <FxSheet />}
        {sheet.kind === "scanpay" && <ScanPaySheet />}
        {["available", "free", "spoken", "protected", "committed", "current"].includes(sheet.kind) && <FigureSheet kind={sheet.kind} twin={sheet.twin} />}
        <button type="button" className={css.cta} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function DataSheet() {
  return (
    <>
      <p className={css.sheetTitle}>How Future Bank uses your data</p>
      <p className={css.lede}>Everything you enter or import is stored to your authenticated account on the server. It is never shared, and there is no preset persona or demo data.</p>
      <ul className={css.proofList}>
        <li><span className={css.proofMark}>→</span> Accounts &amp; transactions: to show real balances and Safe-to-Spend.</li>
        <li><span className={css.proofMark}>→</span> Income &amp; bills: to project what arrives next and what's spoken for.</li>
        <li><span className={css.proofMark}>→</span> Goals: to show trade-offs before you commit.</li>
      </ul>
      <p className={css.micro}>You can export or delete everything from Account settings at any time.</p>
    </>
  );
}

/* ---- Bank Now sheets: honest capability states ---- */
function PayNowSheet({ fb, onClose }) {
  const [accts, setAccts] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/bank/accounts").then((r) => r.json()).then((d) => {
      const a = d.accounts ?? [];
      setAccts(a);
      if (a[0]) setFrom(a[0].id);
      if (a[1]) setTo(a[1].id);
    });
  }, []);

  const move = async () => {
    const p = parseMoneyInput(amount, { min: 1 });
    if (!p.ok) return setMsg(p.error);
    if (from === to) return setMsg("Choose two different accounts.");
    setBusy(true);
    try {
      const d = await POST("/api/bank/transactions", {
        action: "transfer",
        fromAccountId: from,
        toAccountId: to,
        amount: p.value,
        idempotencyKey: `fb-transfer-${from}-${to}-${p.value}-${Date.now()}`,
      });
      if (!d.ok) throw new Error(d.error || "transfer");
      setMsg(`Moved ${sgd(p.value)}. Your money picture is updating…`);
      await fb.refetchAll();
      setTimeout(onClose, 900);
    } catch {
      setMsg("Could not complete the transfer. Nothing was moved — check your activity.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className={css.sheetTitle}>PayNow</p>
      <p className={css.micro}><b>External PayNow is not connected.</b> This preview can only move money between your own accounts — a real ledger entry, no external rail.</p>
      {accts.length < 2 ? (
        <p className={css.lede}>Add a second account first, then you can move money between them here.</p>
      ) : (
        <>
          <div className={css.field}>
            <label htmlFor="pn-from">From</label>
            <select id="pn-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {accts.map((a) => <option key={a.id} value={a.id}>{a.displayName || a.kind} · {sgd(a.availableBalance)}</option>)}
            </select>
          </div>
          <div className={css.field}>
            <label htmlFor="pn-to">To</label>
            <select id="pn-to" value={to} onChange={(e) => setTo(e.target.value)}>
              {accts.map((a) => <option key={a.id} value={a.id}>{a.displayName || a.kind}</option>)}
            </select>
          </div>
          <div className={css.field}>
            <label htmlFor="pn-amt">Amount</label>
            <input id="pn-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 200" />
          </div>
          {msg ? <span className={css.err}>{msg}</span> : null}
          <button type="button" className={css.cta} disabled={busy} onClick={move}>{busy ? "Moving…" : "Move my money"}</button>
        </>
      )}
    </>
  );
}
function FxSheet() {
  return (
    <>
      <p className={css.sheetTitle}>Foreign Exchange</p>
      <p className={css.lede}><b>Indicative rate only.</b> No executable FX provider is connected to this preview, so Future Bank cannot quote or book a real conversion.</p>
      <p className={css.micro}>When a provider is connected, this is where a live quote, the spread and a book button would appear.</p>
    </>
  );
}
function ScanPaySheet() {
  return (
    <>
      <p className={css.sheetTitle}>Scan &amp; Pay</p>
      <p className={css.lede}><b>Not connected.</b> Merchant QR payments need a payment rail this preview does not have. The camera is intentionally not opened.</p>
      <p className={css.micro}>Nothing here can move money until a real rail is connected.</p>
    </>
  );
}

function ProblemSheet({ twin, onGoHome, onGoSnapshot, onClose }) {
  const cases = twin?.rescueCases ?? [];
  const [picked, setPicked] = useState(null);
  const options = [
    { id: "payment_failed", label: "A payment or bill is under pressure", match: (c) => ["payment_failed", "low_balance_ahead", "bills_clustered", "plan_squeezes_emergency"].includes(c.kind) },
    { id: "large_unusual_spend", label: "I don't recognise a transaction", match: (c) => ["large_unusual_spend"].includes(c.kind) },
    { id: "salary_missing", label: "My income is late or interrupted", match: (c) => ["salary_missing"].includes(c.kind) },
  ];
  if (picked) {
    const opt = options.find((o) => o.id === picked);
    const found = cases.find(opt.match);
    return (
      <>
        <button type="button" className={css.backLink} onClick={() => setPicked(null)}>← Back</button>
        <p className={css.sheetTitle}>{opt.label}</p>
        {found ? (
          <>
            <p className={css.lede}><b>{found.whatHappened}</b></p>
            <p className={css.micro}>{found.whyItMatters}</p>
            {found.atRisk?.length ? <p className={css.micro}>At risk: {found.atRisk.join(", ")}.</p> : null}
            <div className={css.choiceGrid}>
              {(found.options ?? []).map((o) => (
                <button key={o.id} type="button" className={css.choice} onClick={() => (o.id === "open_mirror" ? onGoHome() : onClose())}>
                  <b>{o.label}</b>
                  {o.id === found.recommendedAction ? <span>Recommended</span> : null}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className={css.lede}>No matching issue is currently found in your data. That's good news.</p>
            <p className={css.micro}>Future Bank keeps watching. If something changes, it will show here and on Today.</p>
            <button type="button" className={css.link} onClick={onGoSnapshot}>Add more to my picture so checks are sharper →</button>
          </>
        )}
      </>
    );
  }
  return (
    <>
      <p className={css.sheetTitle}>What kind of problem?</p>
      <div className={css.choiceGrid}>
        {options.map((o) => (
          <button key={o.id} type="button" className={css.choice} onClick={() => setPicked(o.id)}>
            <b>{o.label}</b>
            <span>{cases.some(o.match) ? "We found something to look at." : "We'll check your data."}</span>
          </button>
        ))}
      </div>
    </>
  );
}

const SERVICES = [
  { id: "accounts", name: "Accounts & balances", help: "See every account, real balances.", status: "live", next: "Open Today", route: "today" },
  { id: "transactions", name: "Transaction activity", help: "Search and review what you spent.", status: "live", next: "Open Today", route: "today" },
  { id: "import", name: "Import a statement", help: "Bring transactions in by CSV.", status: "live", next: "Start in Money Snapshot", route: "snapshot" },
  { id: "safe_to_spend", name: "Safe-to-Spend", help: "How much you can safely use today.", status: "live", next: "Open Today", route: "today" },
  { id: "money_current", name: "Money Current", help: "What arrives next and what's protected.", status: "live", next: "Open Today", route: "today" },
  { id: "home", name: "Home Horizon", help: "Plan a home against your money.", status: "live", next: "Start", route: "home" },
  { id: "history", name: "Change history", help: "Every confirmed change, newest first.", status: "live", next: "Open history", route: "history" },
  { id: "guardian", name: "Guardian", help: "What needs a decision, on one model.", status: "live", next: "Open Guardian", route: "guardian" },
  { id: "transfer", name: "Move money between my accounts", help: "A real internal ledger transfer.", status: "live", next: "Open PayNow", route: "today" },
  { id: "pay", name: "Pay someone outside the bank", help: "Send money to another person / biller.", status: "soon", next: "Needs a connected payment rail" },
  { id: "scan_pay", name: "Scan & Pay", help: "Pay a merchant by QR.", status: "soon", next: "Needs a connected payment rail" },
  { id: "fx", name: "Foreign exchange", help: "Convert or send another currency.", status: "soon", next: "Needs a connected FX provider" },
  { id: "cross_bank", name: "Connect other banks", help: "Bring in accounts held elsewhere.", status: "soon", next: "Needs SGFinDex" },
  { id: "insurance", name: "Protection review", help: "Estimate a cover gap.", status: "soon", next: "Needs a licensed provider" },
];
function ServicesSheet({ onRoute, onClose }) {
  const [q, setQ] = useState("");
  const list = SERVICES.filter((s) => (s.name + s.help).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <p className={css.sheetTitle}>All services</p>
      <input className={css.searchBox} placeholder="Search services" value={q} onChange={(e) => setQ(e.target.value)} />
      <div>
        {list.map((s) => (
          <div key={s.id} className={`${css.svcItem} ${s.status === "soon" ? css.disabled : ""}`}>
            <div className={css.svcTop}>
              <span className={css.svcName}>{s.name}</span>
              <span className={`${css.svcStatus} ${s.status === "live" ? css.live : css.soon}`}>{s.status === "live" ? "Available" : "Not connected"}</span>
            </div>
            <span className={css.svcHelp}>{s.help}</span>
            <button
              type="button"
              className={css.svcNext}
              disabled={s.status === "soon"}
              onClick={() => (s.route ? onRoute?.(s.route) : onClose())}
            >
              {s.next}{s.status === "live" ? " →" : ""}
            </button>
          </div>
        ))}
        {list.length === 0 ? <p className={css.micro}>No services match "{q}".</p> : null}
      </div>
    </>
  );
}

function FigureSheet({ kind, twin }) {
  const s2s = twin?.safeToSpend ?? {};
  const bd = s2s.breakdown ?? {};
  const bb = twin?.twin?.balanceBreakdown ?? {};
  const MAP = {
    available: {
      title: "Available now",
      value: sgd(s2s.safeToSpend),
      means: "Money you can use now without breaking a bill, your safety reserve, or a commitment.",
      formula: "Liquid cash − bills due before your next income − protected reserve − amount already committed to plans.",
      parts: [["Liquid cash", sgd(bd.postedLiquidCash)], ["Due before next income", `− ${sgd(bd.nearTermObligations)}`], ["Protected reserve", `− ${sgd(bd.protectedReserve)}`], ["Committed to plans", `− ${sgd(bd.alreadyCommitted)}`]],
      confidence: "From your ledger + entered income/bills.",
      change: "A new bill, a change to your income date, or sealing a plan.",
    },
    protected: { title: "Protected", value: sgd(bb.protectedFor), means: "Cash you deliberately set aside as a safety buffer. Held out of Available.", formula: "Balances you earmarked as an emergency / safety reserve.", parts: [], confidence: "From what you marked protected.", change: "Changing your safety-buffer target." },
    committed: {
      title: "Committed / month",
      value: sgd(twin?.twin?.committedMonthlyTotal),
      means: "The total your sealed plans claim from your money every month.",
      formula: "Sum of the monthly contribution of every active commitment.",
      parts: [["Active commitments", sgd(twin?.twin?.committedMonthlyTotal)]],
      confidence: "From your active commitments.",
      change: "Sealing, pausing or revoking a plan.",
    },
    free: { title: "Free", value: sgd(bb.availableNow), means: "Liquid cash not protected and not spoken for.", formula: "Liquid cash − protected − spoken for.", parts: [["Liquid cash", sgd(bd.postedLiquidCash)], ["Protected", `− ${sgd(bb.protectedFor)}`], ["Spoken for", `− ${sgd(bb.spokenFor)}`]], confidence: "From your ledger.", change: "Spending, or moving money into a goal." },
    spoken: { title: "Spoken for", value: sgd(bb.spokenFor), means: "Liquid money a sealed plan already claims each month.", formula: "The smaller of your liquid cash and your committed monthly total.", parts: [["Committed monthly", sgd(twin?.twin?.committedMonthlyTotal)]], confidence: "From your active commitments.", change: "Sealing, pausing or revoking a plan." },
    current: { title: "Your money current", value: "", means: "The real events flowing through your money: what's safe now, the next bill, the next income, what's protected, and any decision you're shaping.", formula: "Now = Available now. Next bill / next income = your soonest entered obligation / inflow. Protected = your safety reserve.", parts: [], confidence: "From your ledger + entered income/bills.", change: "Any new transaction, bill, income change, or plan." },
  };
  const d = MAP[kind] ?? MAP.available;
  return (
    <>
      <p className={css.sheetTitle}>{d.title}{d.value ? ` · ${d.value}` : ""}</p>
      <p className={css.lede}>{d.means}</p>
      <p className={css.micro}><b>How it's worked out:</b> {d.formula}</p>
      {d.parts.length ? (
        <div>
          {d.parts.map(([k, v], i) => (
            <div key={i} className={css.sheetKV}><span>{k}</span><span>{v}</span></div>
          ))}
        </div>
      ) : null}
      <p className={css.micro}><b>Confidence:</b> {d.confidence}</p>
      <p className={css.micro}><b>What could change it:</b> {d.change}</p>
    </>
  );
}
