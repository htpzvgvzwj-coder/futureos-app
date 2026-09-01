"use client";

// Future Bank - the "Money Current" experience. One product feeling: real
// money events flow through time; you see what is safe now, what arrives
// next, what is spoken for, and how one future decision changes that.
//
//   Welcome -> Money Snapshot (3 steps) -> Today -> What needs you next
//   -> Home Horizon -> Change Receipt
//
// Real server data throughout. Estimates and user-ranges are shown, quietly.

import { useCallback, useEffect, useState } from "react";
import css from "./fb.module.css";
import { MoneyCurrent, MoneyCurrentRipple } from "./MoneyCurrent.jsx";
import { parseMoneyInput, formatMoney } from "../../lib/money-input.js";

const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
const POST = (url, body) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, ...j })));

export function FutureBankSlice({ onExitToApp = null }) {
  const [auth, setAuth] = useState("checking");
  const [step, setStep] = useState("welcome");
  const [twin, setTwin] = useState(null);
  const [twinState, setTwinState] = useState("idle");
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuth(d?.id ? "in" : "anon"))
      .catch(() => setAuth("anon"));
  }, []);

  const loadTwin = useCallback(async () => {
    setTwinState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const r = await fetch("/api/financial-twin", { headers: { "cache-control": "no-cache" } });
      if (!r.ok) return setTwinState(r.status === 401 ? "anon" : "error");
      setTwin(await r.json());
      setTwinState("ready");
    } catch {
      setTwinState("error");
    }
  }, []);
  useEffect(() => {
    if (auth === "in") loadTwin();
  }, [auth, loadTwin]);

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

  const partial = twin && (twin.isEmpty || (twin.counts && twin.counts.incomeStreams === 0));

  return (
    <Shell>
      {step === "welcome" && <Welcome onStart={() => setStep(twin && !twin.isEmpty ? "today" : "snapshot")} onData={() => setSheet({ kind: "data" })} />}
      {step === "snapshot" && <MoneySnapshot onDone={() => { loadTwin(); setStep("today"); }} onExplore={() => setStep("needs") } />}
      {step === "complete" && <CompletePicture onDone={() => { loadTwin(); setStep("today"); }} />}
      {step === "today" && (
        <Today twin={twin} state={twinState} partial={partial} onReload={loadTwin} onExplain={(k) => setSheet({ kind: k, twin })} onNext={() => setStep("needs")} onAddSource={() => setStep("snapshot")} onComplete={() => setStep("complete")} />
      )}
      {step === "needs" && (
        <NeedsNext twin={twin} onBack={() => setStep("today")} onHome={() => setStep("home")} onSnapshot={() => setStep("snapshot")} onProblem={() => setSheet({ kind: "problem", twin })} onServices={() => setSheet({ kind: "services" })} onUnderstand={() => setStep("today")} />
      )}
      {step === "home" && <HomeHorizon onBack={() => setStep("needs")} onReceipt={loadTwin} />}

      {sheet && <BottomSheet sheet={sheet} onClose={() => setSheet(null)} onGoHome={() => { setSheet(null); setStep("home"); }} onGoSnapshot={() => { setSheet(null); setStep("snapshot"); }} />}
      {onExitToApp ? (
        <button type="button" className={css.backLink} style={{ opacity: 0.5, marginTop: "auto" }} onClick={onExitToApp}>
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
// A small honest illustrative current for the welcome only (no user data yet).
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
    if (begin === "goal") {
      onExplore();
      return;
    }
    if (begin === "import") {
      setN(9); // import sub-view
      return;
    }
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
            <button key={o.id} type="button" className={css.choice} aria-pressed={begin === o.id} onClick={() => { setBegin(o.id); setN(o.id === "import" || o.id === "goal" ? n : 2); if (o.id === "import" || o.id === "goal") submitAccountLater(o.id); }}>
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

  function submitAccountLater(id) {
    if (id === "goal") onExplore();
    if (id === "import") setN(9);
  }
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

/* ================= "Complete my picture" (later) ================= */
function CompletePicture({ onDone }) {
  const [tab, setTab] = useState("income");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState("");
  const save = async () => {
    const p = parseMoneyInput(amount, { min: 0 });
    if (!p.ok) return setMsg(p.error);
    const kind = tab;
    const data = kind === "income" ? { kind: "salary", label: label || "Salary", monthlyAmount: p.value } : { label: label || "Bill", monthlyAmount: p.value };
    const d = await POST("/api/financial-twin/rows", { kind: kind === "income" ? "income" : "recurring", data });
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

/* ================= C. Today ================= */
function Today({ twin, state, partial, onReload, onExplain, onNext, onAddSource, onComplete }) {
  if (state === "loading" || state === "idle") return <p className={css.lede}>Loading your money…</p>;
  if (state === "error")
    return (
      <>
        <p className={css.lede}>Your money picture didn't load.</p>
        <button type="button" className={css.cta} onClick={onReload}>Try again</button>
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
  const bd = twin.twin?.balanceBreakdown ?? {};
  const txns = (twin.recentTransactions ?? []).filter((t) => t.channel !== "opening_balance");

  return (
    <>
      <div>
        <p className={css.kicker}>Today · {new Date().toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className={css.micro}>Balances from your ledger · tap the amount, the current or a state to explain it</p>
      </div>

      <div className={css.bigAmountWrap}>
        <span className={css.bigAmountLabel}>Available to spend</span>
        <button
          type="button"
          className={`${css.bigAmount} ${s2s.belowProtectedFloor ? css.warn : ""}`}
          aria-label={`Available to spend, ${sgd(s2s.safeToSpend)}. Tap for how this is worked out.`}
          onClick={() => onExplain("available")}
        >
          {sgd(s2s.safeToSpend)} <span className={css.infoDot}>ⓘ</span>
        </button>
      </div>

      <MoneyCurrent twin={twin} onExplain={() => onExplain("current")} />

      <div className={css.stateRow}>
        <button type="button" className={css.stateChip} onClick={() => onExplain("free")}>
          <small className={css.dotFree}>Free</small>
          <b>{sgd(bd.availableNow)}</b>
        </button>
        <button type="button" className={css.stateChip} onClick={() => onExplain("spoken")}>
          <small className={css.dotSpoken}>Spoken for</small>
          <b>{sgd(bd.spokenFor)}</b>
        </button>
        <button type="button" className={css.stateChip} onClick={() => onExplain("protected")}>
          <small className={css.dotProtected}>Protected</small>
          <b>{sgd(bd.protectedFor)}</b>
        </button>
      </div>

      {partial ? (
        <div className={css.partial}>
          <b>Your picture is still partial</b>
          <span>Add income and bills to see further ahead and get sharper guidance.</span>
          <button type="button" className={css.link} onClick={onComplete}>Complete my picture →</button>
        </div>
      ) : null}

      <div>
        <p className={css.kicker} style={{ marginBottom: 6 }}>Recent activity</p>
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
      </div>

      <button type="button" className={css.cta} onClick={onNext}>See what needs you next</button>
    </>
  );
}

/* ================= D. What needs you next ================= */
function NeedsNext({ twin, onBack, onHome, onSnapshot, onProblem, onServices, onUnderstand }) {
  const rescue = twin?.rescueCases?.[0] ?? null;
  const partial = twin && (twin.isEmpty || (twin.counts && twin.counts.incomeStreams === 0));
  const hasTxns = (twin?.recentTransactions ?? []).some((t) => t.channel !== "opening_balance");

  let rec;
  if (rescue) rec = { title: rescue.whatHappened, why: rescue.whyItMatters, next: rescue.options?.[0]?.label ?? "See your options", cta: "Look at this", onClick: onProblem };
  else if (partial) rec = { title: "Make your picture sharper", why: "Future Bank can't see far ahead without your income and bills.", next: "Add them in a minute", cta: "Complete my picture", onClick: onSnapshot };
  else if (!hasTxns) rec = { title: "Bring in your transactions", why: "Spending, bills and Safe-to-Spend all get sharper with real history.", next: "Import a CSV statement", cta: "Import now", onClick: onSnapshot };
  else rec = { title: "Shape a home plan", why: "You have the basics. See how a real plan sits against your money.", next: "Answer 2 quick questions", cta: "Start", onClick: onHome };

  return (
    <>
      <button type="button" className={css.backLink} onClick={onBack}>← Today</button>
      <h1 className={css.title}>What needs you next</h1>

      <div className={css.ripple} style={{ borderLeft: "3px solid var(--sea)" }}>
        <p className={css.kicker}>Recommended</p>
        <b style={{ fontSize: 16 }}>{rec.title}</b>
        <span className={css.micro}>Why now: {rec.why}</span>
        <span className={css.micro}>Next: {rec.next}</span>
        <button type="button" className={`${css.cta} ${css.ctaSea}`} onClick={rec.onClick} style={{ marginTop: 4 }}>{rec.cta}</button>
      </div>

      <p className={css.kicker} style={{ marginTop: 4 }}>Or choose a direction</p>
      <div className={css.choiceGrid}>
        <button type="button" className={css.choice} onClick={onUnderstand}><b>Understand my money</b><span>Where it goes, what's recurring, what changed.</span></button>
        <button type="button" className={css.choice} onClick={onProblem}><b>Solve a problem</b><span>A payment, a bill, a tight month, an unfamiliar charge.</span></button>
        <button type="button" className={css.choice} onClick={onHome}><b>Build a future</b><span>Plan a home and see the cost to your other goals.</span></button>
      </div>

      <button type="button" className={css.link} onClick={onServices}>All services</button>
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

function HomeHorizon({ onBack, onReceipt }) {
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
      // Technical reason stays in dev logs only; the user sees humanSealBlock().
      console.warn(`[FutureBank] Home path not yet sealable — server reason: ${v.reason}`);
    }
    setPath(field);
    setPhase("receipt");
    onReceipt?.();
  };

  const after = path ? summarise(path) : null;
  const priceMid = PRICE_BANDS.find((b) => b.id === band)?.mid ?? null;

  return (
    <>
      <button type="button" className={css.backLink} onClick={onBack}>← What needs you next</button>
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
            <MoneyCurrentRipple
              before={`Monthly pace ${before?.monthly ? sgd(before.monthly) : "SGD 0"} · window ${before?.readyMonth ?? "unset"}`}
              changedLabel={`Set aside ${sgd(after.monthly ?? pace)} each month`}
              after={`Monthly pace ${sgd(after.monthly ?? pace)} · window ${after.readyMonth ?? "not yet reachable"}`}
              movedRows={movedRows(before, after)}
              consequence={
                humanSealBlock(path?.realityPath?.sealableVerdict?.sealable ? null : path?.realityPath?.sealableVerdict?.reason) ??
                "This path is ready to become a commitment when you are."
              }
              onNext={onBack}
              nextLabel="Back to what needs you next"
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

function summarise(field) {
  const rp = field?.realityPath ?? {};
  return { monthly: rp.monthlyContribution ?? rp.data?.monthly_contribution ?? null, readyMonth: rp.readyMonth ?? null, monthsToReady: rp.monthsToReady ?? null };
}
function movedRows(b, a) {
  const rows = [];
  if (b && a && b.readyMonth && a.readyMonth && b.readyMonth !== a.readyMonth) {
    rows.push({ text: `Home window moved to ${a.readyMonth}`, delta: `was ${b.readyMonth}`, up: a.readyMonth < b.readyMonth });
  }
  return rows;
}
function projectYear(year, pace, priceMid) {
  if (!priceMid || !pace) return year;
  const need = priceMid * 0.25; // rough down-payment
  const months = Math.ceil(need / pace);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.getFullYear();
}

/* ================= Bottom sheet ================= */
function BottomSheet({ sheet, onClose, onGoHome, onGoSnapshot }) {
  return (
    <div className={css.sheetScrim} onClick={onClose}>
      <div className={css.sheet} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <span className={css.sheetGrip} />
        {sheet.kind === "data" && <DataSheet />}
        {sheet.kind === "problem" && <ProblemSheet twin={sheet.twin} onGoHome={onGoHome} onGoSnapshot={onGoSnapshot} onClose={onClose} />}
        {sheet.kind === "services" && <ServicesSheet onGoHome={onGoHome} onClose={onClose} />}
        {["available", "free", "spoken", "protected", "current"].includes(sheet.kind) && <FigureSheet kind={sheet.kind} twin={sheet.twin} />}
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
  { id: "accounts", name: "Accounts & balances", help: "See every account, real balances.", status: "live", next: "Open Today" },
  { id: "transactions", name: "Transaction activity", help: "Search and review what you spent.", status: "live", next: "Open Today" },
  { id: "import", name: "Import a statement", help: "Bring transactions in by CSV.", status: "live", next: "Start in Money Snapshot" },
  { id: "safe_to_spend", name: "Safe-to-Spend", help: "How much you can safely use today.", status: "live", next: "Open Today" },
  { id: "money_current", name: "Money Current", help: "What arrives next and what's protected.", status: "live", next: "Open Today" },
  { id: "home", name: "Home Horizon", help: "Plan a home against your money.", status: "live", next: "Start", route: "home" },
  { id: "transfer", name: "Transfer between my accounts", help: "Move your own money (real ledger entry).", status: "live", next: "Coming to this preview" },
  { id: "pay", name: "Pay someone / a bill", help: "Send money outside the bank.", status: "soon", next: "Needs a connected payment rail" },
  { id: "scan_pay", name: "Scan & Pay", help: "Pay a merchant by QR.", status: "soon", next: "Needs a connected payment rail" },
  { id: "cross_bank", name: "Connect other banks", help: "Bring in accounts held elsewhere.", status: "soon", next: "Needs SGFinDex" },
  { id: "insurance", name: "Protection review", help: "Estimate a cover gap.", status: "soon", next: "Needs a licensed provider" },
];
function ServicesSheet({ onGoHome, onClose }) {
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
              onClick={() => (s.route === "home" ? onGoHome() : onClose())}
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
      title: "Available to spend",
      value: sgd(s2s.safeToSpend),
      means: "Money you can use now without breaking a bill, your safety reserve, or a commitment.",
      formula: "Liquid cash − bills due before your next income − protected reserve − amount already committed to plans.",
      parts: [["Liquid cash", sgd(bd.postedLiquidCash)], ["Due before next income", `− ${sgd(bd.nearTermObligations)}`], ["Protected reserve", `− ${sgd(bd.protectedReserve)}`], ["Committed to plans", `− ${sgd(bd.alreadyCommitted)}`]],
      confidence: "From your ledger + entered income/bills.",
      change: "A new bill, a change to your income date, or sealing a plan.",
    },
    free: { title: "Free", value: sgd(bb.availableNow), means: "Liquid cash not protected and not spoken for.", formula: "Liquid cash − protected − spoken for.", parts: [["Liquid cash", sgd(bd.postedLiquidCash)], ["Protected", `− ${sgd(bb.protectedFor)}`], ["Spoken for", `− ${sgd(bb.spokenFor)}`]], confidence: "From your ledger.", change: "Spending, or moving money into a goal." },
    spoken: { title: "Spoken for", value: sgd(bb.spokenFor), means: "Liquid money a sealed plan already claims each month.", formula: "The smaller of your liquid cash and your committed monthly total.", parts: [["Committed monthly", sgd(twin?.twin?.committedMonthlyTotal)]], confidence: "From your active commitments.", change: "Sealing, pausing or revoking a plan." },
    protected: { title: "Protected", value: sgd(bb.protectedFor), means: "Cash you deliberately set aside as a safety buffer.", formula: "Balances you earmarked as an emergency / safety reserve.", parts: [], confidence: "From what you marked protected.", change: "Changing your safety-buffer target." },
    current: { title: "Your money current", value: "", means: "The real events flowing through your money: what's safe now, the next bill, the next income, what's protected, and any decision you're shaping.", formula: "Now = Available to spend. Next bill / next income = your soonest entered obligation / inflow. Protected = your safety reserve.", parts: [], confidence: "From your ledger + entered income/bills.", change: "Any new transaction, bill, income change, or plan." },
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
