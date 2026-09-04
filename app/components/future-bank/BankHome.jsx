"use client";

// The OCBC Future Bank home (the "Today" tab). One clean bank front page:
//
//   1 Money position  - Available now / Protected / Committed (tap = explain)
//   2 Bank now        - PayNow / Foreign Exchange / Scan & Pay
//   3 Money Current   - now -> next bill -> next income -> protected -> decision
//   4 One thing that needs you  - the top real Money Moment (or calm)
//   5 What changed    - one persisted consequence
//   6 Plans in motion - active drafts + commitments
//   7 Recent activity - real ledger transactions
//
// All data comes from FutureBankDataProvider (twin + money-moments +
// life-thread + ripple + ledger). Nothing computed here.

import { useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import { FeatureHistory } from "./FeatureHistory.jsx";
import { MoneyCurrent } from "../../showcase/MoneyCurrent.jsx";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { BankNowActions } from "./BankNowActions.jsx";
import { DetectedMoments } from "./DetectedMoments.jsx";
import { MoneyChangedReceipt } from "./MoneyChangedReceipt.jsx";
import { ActivePlanRail } from "./ActivePlanRail.jsx";
import { useTx } from "./i18n.jsx";
import { echoPayment, ECHO_MIN } from "../../../lib/life/echo-payment.js";
import { resolveStage, STAGE_SURFACE } from "../../../lib/family-relay/stages.js";
import { buildGrowingAccount, buildCalmToday } from "../../../lib/family-relay/surfaces.js";

const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;

// The life-stage surface this account should see on Today. Fetches the
// account type + circle + birth year once; defaults to the standard Today.
function useTodaySurface() {
  const [info, setInfo] = useState({ surface: "standard", stage: "independent" });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ob, rolesRes, care] = await Promise.all([
          fetch("/api/onboarding", { headers: { "cache-control": "no-cache" } }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/account?view=roles", { headers: { "cache-control": "no-cache" } }).then((r) => (r.ok ? r.json() : { roles: [] })),
          fetch("/api/care", { headers: { "cache-control": "no-cache" } }).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (!alive) return;
        const accountType = ob?.onboarding?.accountType ?? "individual";
        const roles = rolesRes?.roles ?? [];
        const birthYear = care?.birthYear ?? null;
        const stage = resolveStage({ accountType, birthYear, roles });
        setInfo({ surface: STAGE_SURFACE[stage] ?? "standard", stage, birthYear, roles });
      } catch {
        /* standard Today is the safe default */
      }
    })();
    return () => { alive = false; };
  }, []);
  return info;
}

// ---- Growing Account (the child / youth Today) ---------------------
function GrowingAccountToday({ tx, fb, twin, onActivity }) {
  const [reqs, setReqs] = useState([]);
  useEffect(() => {
    fetch("/api/authorizations", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReqs((d?.requests ?? []).filter((x) => x.status === "pending")))
      .catch(() => {});
  }, []);

  const balance = twin?.safeToSpend?.breakdown?.postedLiquidCash ?? fb.bankNow?.available ?? null;
  const commitments = fb.lifeThread?.commitments ?? twin?.twin?.commitments ?? [];
  const spends = (twin?.recentTransactions ?? []).filter((t) => t.direction === "debit" && t.channel !== "opening_balance" && !t.isInternalTransfer);
  const g = buildGrowingAccount({
    balance,
    goals: commitments.map((c) => ({ label: cap(c.domain), saved: 0, target: 0, monthly: c.monthlyContribution })),
    recentSpending: spends.map((t) => ({ merchant: t.merchant, amount: t.amount, at: t.postedAt })),
    pendingRequests: reqs.map((r) => ({ amount: r.amount, merchant: r.payload?.merchant ?? r.summary })),
  });

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <p className={css.kicker}>{tx("Today")}</p>
        {g.haveText ? (
          <div className={css.section}>
            <h1 className={css.title}>{g.haveText}</h1>
            <p className={css.micro}>{tx("what you have")}</p>
          </div>
        ) : null}

        {g.savingFor.length ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("Saving for")}</p>
            {g.savingFor.map((s) => (
              <div key={s.label} className={css.sheetKV}><span>{tx(s.label)}</span><span>{s.monthly ? sgd(s.monthly) + "/mo" : ""}</span></div>
            ))}
          </section>
        ) : null}

        {g.waitingForYes.length ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("Waiting for a yes")}</p>
            {g.waitingForYes.map((w, i) => (
              <div key={i} className={css.sheetKV}><span>{w.merchant}</span><span>{sgd(w.amount)}</span></div>
            ))}
          </section>
        ) : null}

        <AskToPayLive tx={tx} onDone={() => fb.refetchAll?.()} />

        {g.recent.length ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("Lately")}</p>
            {g.recent.map((r, i) => (
              <div key={i} className={css.sheetKV}><span>{r.merchant}</span><span>−{sgd(r.amount)}</span></div>
            ))}
            <button type="button" className={css.link} onClick={onActivity}>{tx("See all")} →</button>
          </section>
        ) : null}
      </div>
    </div>
  );
}

// ---- Calm Today (the later-life Today) ----------------------------
function CalmTodayView({ tx, fb, twin, surface, topMoment, onActivity, onGuardian }) {
  const balance = fb.bankNow?.available ?? twin?.safeToSpend?.safeToSpend ?? null;
  const ni = twin?.safeToSpend?.nextIncome ?? null;
  const nb = fb.bankNow?.nextEvent?.kind === "bill" ? fb.bankNow.nextEvent : (twin?.safeToSpend?.nearTermObligationsList ?? [])[0] ?? null;
  const contacts = (surface.roles ?? []).filter((r) => ["trusted_contact", "guardian"].includes(r.role) && (r.status == null || r.status === "active"));
  const c = buildCalmToday({
    balance,
    nextIncome: ni ? { label: ni.label, amount: ni.amount, when: ni.expectedDate } : null,
    nextBill: nb ? { label: nb.label, amount: Math.abs(nb.amount ?? 0), when: nb.when ?? nb.dueDate } : null,
    oneThing: topMoment ? { text: topMoment.title, kind: topMoment.kind } : null,
    trustedContacts: contacts,
  });

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={`${css.shell} ${css.calm}`}>
        <p className={css.kicker}>{tx("Today")}</p>
        {c.balanceText ? (
          <div className={css.section}>
            <h1 className={css.title} style={{ fontSize: "2rem" }}>{c.balanceText}</h1>
            <p className={css.lede}>{tx("in your account now")}</p>
          </div>
        ) : null}

        {c.nextIncome ? (
          <div className={css.sheetKV}><span>{tx("Next money in")}</span><span>{sgd(c.nextIncome.amount)}{c.nextIncome.when ? ` · ${c.nextIncome.when}` : ""}</span></div>
        ) : null}
        {c.nextBill ? (
          <div className={css.sheetKV}><span>{tx("Next bill")}</span><span>{sgd(c.nextBill.amount)}{c.nextBill.when ? ` · ${c.nextBill.when}` : ""}</span></div>
        ) : null}

        {c.oneThing?.text ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("One thing to look at")}</p>
            <p className={css.lede}>{c.oneThing.text}</p>
            <button type="button" className={css.cta} onClick={onGuardian}>{tx("Open Guardian")}</button>
          </section>
        ) : (
          <p className={css.lede}>{tx("Nothing needs you right now.")}</p>
        )}

        <PaymentPauseLive tx={tx} onDone={() => fb.refetchAll?.()} />

        {c.callList.length ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("People you can call")}</p>
            {c.callList.map((p, i) => <div key={i} className={css.sheetKV}><span>{p.label}</span><span /></div>)}
          </section>
        ) : null}

        <button type="button" className={css.link} onClick={onActivity}>{tx("See everything")} →</button>
      </div>
    </div>
  );
}

// Live Ask to Pay / Payment Pause — hit the real family-relay endpoints so
// the decision + its reasons land in the Change Ledger.
function AskToPayLive({ tx, onDone }) {
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const r = await fetch("/api/family-relay/ask", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), merchant }),
    }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    setRes(r);
    if (r?.evaluation) onDone?.();
  };
  return (
    <section className={css.section}>
      <p className={css.kicker}>{tx("Ask to Pay")}</p>
      <div className={css.field}><label htmlFor="g-amt">{tx("Amount (SGD)")}</label>
        <input id="g-amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} /></div>
      <div className={css.field}><label htmlFor="g-mer">{tx("Pay to")}</label>
        <input id="g-mer" type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} /></div>
      <button type="button" className={css.cta} disabled={busy || !amount} onClick={send}>{busy ? tx("Working…") : tx("Ask")}</button>
      {res?.evaluation ? (
        <div className={css.calmCard}>
          <b className={css.micro}>{{ auto_ok: "✓ " + tx("Goes through"), needs_approval: "◔ " + tx("Sent to a guardian"), blocked: "✕ " + tx("Held") }[res.evaluation.outcome]}</b>
          {res.evaluation.reasons.map((x, i) => <span key={i} className={css.micro}>{x.text}</span>)}
        </div>
      ) : null}
    </section>
  );
}

function PaymentPauseLive({ tx, onDone }) {
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const r = await fetch("/api/family-relay/pause", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), payee }),
    }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    setRes(r);
    if (r?.evaluation) onDone?.();
  };
  return (
    <section className={css.section}>
      <p className={css.kicker}>{tx("Make a payment")}</p>
      <div className={css.field}><label htmlFor="p-amt">{tx("Amount (SGD)")}</label>
        <input id="p-amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} /></div>
      <div className={css.field}><label htmlFor="p-pay">{tx("Pay to")}</label>
        <input id="p-pay" type="text" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
      <button type="button" className={css.cta} disabled={busy || !amount} onClick={send}>{busy ? tx("Working…") : tx("Pay")}</button>
      {res?.evaluation ? (
        res.evaluation.paused ? (
          <div className={css.calmCard}>
            <b className={css.micro}>⚠ {tx("Paused — here's why")}</b>
            {res.evaluation.triggers.map((t, i) => <span key={i} className={css.micro}>{t.text}</span>)}
          </div>
        ) : (
          <div className={css.calmCard}><b className={css.micro}>✓ {tx("Goes through — nothing unusual about this one")}</b></div>
        )
      ) : null}
    </section>
  );
}

const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());

export function BankHome(props) {
  return (
    <FutureBankDataProvider enabled>
      <BankHomeInner {...props} />
    </FutureBankDataProvider>
  );
}

function BankHomeInner({ onExplore, onLife, onGuardian, onActivity, onStudio, onAddReality, onTwin }) {
  const { tx } = useTx();
  const fb = useFutureBankData();
  const { twin, status } = fb;
  const [sheet, setSheet] = useState(null);
  const surface = useTodaySurface();

  const route = (r) => {
    const s = String(r || "");
    if (s === "history") return onLife?.();
    if (s === "guardian") return onGuardian?.();
    if (s.startsWith("studio:")) return onStudio?.(s.slice(7));
    if (s === "home") return onStudio?.("home");
    if (s === "today:activity") return onActivity?.();
    if (s.startsWith("explore")) return onExplore?.();
    // "today" and anything else: stay here
  };

  if ((status === "loading" || status === "idle") && !twin) {
    return <div className={`${css.app} ${css.embedded}`}><div className={css.shell}><p className={css.lede}>{tx("Loading your money…")}</p></div></div>;
  }
  if (status === "error" && !twin) {
    return (
      <div className={`${css.app} ${css.embedded}`}><div className={css.shell}>
        <p className={css.lede}>{tx("Your money picture didn't load.")}</p>
        <button type="button" className={css.cta} onClick={fb.refetchAll}>{tx("Try again")}</button>
      </div></div>
    );
  }

  const s2s = twin?.safeToSpend ?? {};
  const bb = twin?.twin?.balanceBreakdown ?? {};
  const committedMonthly = twin?.twin?.committedMonthlyTotal ?? fb.resourceSummary?.committedMonthly ?? 0;
  const txns = (twin?.recentTransactions ?? []).filter((t) => t.channel !== "opening_balance");
  const needsCount = fb.momentsRaw?.counts?.actionRequired ?? 0;
  const topMoment = (fb.moments ?? []).find((m) => m.state === "new" && (m.severity === "action_required" || m.severity === "watch")) ?? null;

  // Age-adapted Today: a child sees Growing Account, someone in later life
  // with trusted help sees Calm Today. Same data, fewer things at once.
  if (twin && !twin.isEmpty && surface.surface === "growing_account") {
    return <GrowingAccountToday tx={tx} fb={fb} twin={twin} onActivity={onActivity} />;
  }
  if (twin && !twin.isEmpty && surface.surface === "calm_today") {
    return <CalmTodayView tx={tx} fb={fb} twin={twin} surface={surface} topMoment={topMoment} onActivity={onActivity} onGuardian={onGuardian} />;
  }
  const decision = topMoment
    ? { label: tx("Review"), whenText: tx("needs you"), effect: topMoment.title, source: tx("Future Bank detection") }
    : null;

  const empty = !twin || twin.isEmpty;

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <div>
          <p className={css.kicker}>{tx("Today")} · {new Date().toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className={css.micro}>{tx("Balances from your ledger · tap the amount, a state or the current to explain it")}</p>
        </div>

        {empty ? (
          <div className={css.section}>
            <h1 className={css.title}>{tx("Add one money source to begin")}</h1>
            <p className={css.lede}>{tx("Your bank picture fills in from your real accounts and transactions. Nothing is assumed.")}</p>
            <button type="button" className={css.cta} onClick={onAddReality}>{tx("Add an account")}</button>
          </div>
        ) : (
          <>
            {/* 1 MONEY POSITION */}
            <div className={css.bigAmountWrap}>
              <span className={css.bigAmountLabel}>{tx("Available now")}</span>
              <button
                type="button"
                className={`${css.bigAmount} ${s2s.belowProtectedFloor ? css.warn : ""}`}
                aria-label={`${tx("Available now")}, ${sgd(s2s.safeToSpend)}.`}
                onClick={() => setSheet({ kind: "available" })}
              >
                {sgd(s2s.safeToSpend)} <span className={css.infoDot}>ⓘ</span>
              </button>
            </div>
            <div className={css.stateRow}>
              <button type="button" className={css.stateChip} onClick={() => setSheet({ kind: "protected" })}>
                <small className={css.dotProtected}>{tx("Protected")}</small>
                <b>{sgd(bb.protectedFor)}</b>
              </button>
              <button type="button" className={css.stateChip} onClick={() => setSheet({ kind: "committed" })}>
                <small className={css.dotSpoken}>{tx("Committed")}</small>
                <b>{sgd(committedMonthly)}<span className={css.perMo}> /mo</span></b>
              </button>
            </div>
            <button type="button" className={css.link} onClick={onTwin}>{tx("See my full money picture →")}</button>

            {/* 2 BANK NOW */}
            <BankNowActions
              onPayNow={() => setSheet({ kind: "paynow" })}
              onFx={() => setSheet({ kind: "fx" })}
              onScanPay={() => setSheet({ kind: "scanpay" })}
            />

            {/* 3 MONEY CURRENT */}
            <MoneyCurrent twin={twin} decision={decision} onExplain={() => setSheet({ kind: "current" })} detail />

            {/* 4 ONE THING THAT NEEDS YOU */}
            <section className={css.section}>
              <p className={css.kicker}>{needsCount > 0 ? `${needsCount} ${needsCount > 1 ? tx("things need you") : tx("thing needs you")}` : tx("One thing that needs you")}</p>
              <DetectedMoments limit={1} exclude={["turning_point"]} onRoute={route} />
            </section>

            {/* 5 WHAT CHANGED */}
            <section className={css.section}>
              <p className={css.kicker}>{tx("What changed")}</p>
              <MoneyChangedReceipt onRoute={route} onHistory={onLife} />
            </section>

            {/* 6 PLANS IN MOTION */}
            <section className={css.section}>
              <p className={css.kicker}>{tx("Plans in motion")}</p>
              <ActivePlanRail limit={3} dense onRoute={route} />
            </section>

            {/* 7 RECENT ACTIVITY */}
            <section className={css.section}>
              <p className={css.kicker}>{tx("Recent activity")}</p>
              {txns.length === 0 ? (
                <p className={css.micro}>{tx("No transactions yet — add or import one to fill this in.")}</p>
              ) : (
                <div className={css.activity}>
                  {txns.slice(0, 5).map((t) => {
                    const canEcho = t.direction === "debit" && Number(t.amount) >= ECHO_MIN && t.channel !== "card_repayment";
                    const Row = canEcho ? "button" : "div";
                    return (
                      <Row
                        key={t.id}
                        type={canEcho ? "button" : undefined}
                        className={css.actItem}
                        style={canEcho ? { width: "100%", background: "none", border: 0, textAlign: "left", cursor: "pointer", font: "inherit" } : undefined}
                        onClick={canEcho ? () => setSheet({ kind: "echo", tx: t }) : undefined}
                      >
                        <span className={`${css.actGlyph} ${t.direction === "debit" ? css.out : ""}`}>{(t.merchant || "?")[0].toUpperCase()}</span>
                        <span className={css.actBody}>
                          <span className={css.actName}>{t.merchant || t.category || t.channel || tx("Payment")}</span>
                          <span className={css.actMeta}>
                            {t.category ?? t.channel ?? ""}{t.status !== "posted" ? ` · ${tx(t.status)}` : ""}
                            {canEcho ? ` · ${tx("see how this moves your life")}` : ""}
                          </span>
                        </span>
                        <span className={`${css.actAmt} ${t.direction === "credit" ? css.in : ""}`}>{t.direction === "credit" ? "+" : "−"} {sgd(t.amount)}</span>
                      </Row>
                    );
                  })}
                </div>
              )}
              <button type="button" className={css.link} onClick={onActivity}>{tx("View all activity →")}</button>
            </section>

            <button type="button" className={css.cta} onClick={onExplore}>{tx("See what needs you next")}</button>
          </>
        )}
        <FeatureHistory feature="today" label="What you've done in Today" />
      </div>

      {sheet && <HomeSheet kind={sheet.kind} tx1={sheet.tx} fb={fb} twin={twin} onClose={() => setSheet(null)} />}
    </div>
  );
}

/* ---- bottom sheets: figure explanations + honest bank-action states ---- */
function HomeSheet({ kind, tx1, fb, twin, onClose }) {
  const { tx } = useTx();
  return (
    <div className={css.sheetScrim} onClick={onClose}>
      <div className={css.sheet} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <span className={css.sheetGrip} />
        {["available", "protected", "committed", "current"].includes(kind) && <FigureSheet kind={kind} twin={twin} />}
        {kind === "paynow" && <PayNowSheet fb={fb} onClose={onClose} />}
        {kind === "fx" && <FxSheet />}
        {kind === "scanpay" && <ScanPaySheet />}
        {kind === "echo" && <EchoSheet txn={tx1} fb={fb} twin={twin} />}
        <button type="button" className={css.cta} onClick={onClose}>{tx("Close")}</button>
      </div>
    </div>
  );
}

function FigureSheet({ kind, twin }) {
  const { tx } = useTx();
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
    committed: { title: "Committed / month", value: sgd(twin?.twin?.committedMonthlyTotal), means: "The total your sealed plans claim from your money every month.", formula: "Sum of the monthly contribution of every active commitment.", parts: [["Active commitments", sgd(twin?.twin?.committedMonthlyTotal)]], confidence: "From your active commitments.", change: "Sealing, pausing or revoking a plan." },
    current: { title: "Your money current", value: "", means: "The real events flowing through your money: what's safe now, the next bill, the next income, what's protected, and any decision you're shaping.", formula: "Now = Available now. Next bill / next income = your soonest entered obligation / inflow. Protected = your safety reserve.", parts: [], confidence: "From your ledger + entered income/bills.", change: "Any new transaction, bill, income change, or plan." },
  };
  const d = MAP[kind] ?? MAP.available;
  return (
    <>
      <p className={css.sheetTitle}>{tx(d.title)}{d.value ? ` · ${d.value}` : ""}</p>
      <p className={css.lede}>{tx(d.means)}</p>
      <p className={css.micro}><b>{tx("How it's worked out:")}</b> {tx(d.formula)}</p>
      {d.parts.length ? (
        <div>{d.parts.map(([k, v], i) => <div key={i} className={css.sheetKV}><span>{tx(k)}</span><span>{v}</span></div>)}</div>
      ) : null}
      <p className={css.micro}><b>{tx("Confidence:")}</b> {tx(d.confidence)}</p>
      <p className={css.micro}><b>{tx("What could change it:")}</b> {tx(d.change)}</p>
    </>
  );
}

function PayNowSheet({ fb, onClose }) {
  const { tx } = useTx();
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
    }).catch(() => {});
  }, []);
  const move = async () => {
    const v = Number(String(amount).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(v) || v <= 0) return setMsg(tx("Enter an amount, e.g. 200"));
    if (from === to) return setMsg(tx("Choose two different accounts."));
    setBusy(true);
    try {
      const r = await fetch("/api/bank/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "transfer", fromAccountId: from, toAccountId: to, amount: v, idempotencyKey: `bh-${from}-${to}-${v}-${Date.now()}` }),
      });
      if (!r.ok) throw new Error();
      setMsg(`${tx("Moved")} ${sgd(v)}. ${tx("Your money picture is updating…")}`);
      await fb.refetchAll();
      setTimeout(onClose, 900);
    } catch {
      setMsg(tx("Could not complete the transfer. Nothing was moved."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className={css.sheetTitle}>{tx("PayNow")}</p>
      <p className={css.micro}><b>{tx("External PayNow is not connected.")}</b> {tx("This preview can only move money between your own accounts — a real ledger entry, no external rail.")}</p>
      {accts.length < 2 ? (
        <p className={css.lede}>{tx("Add a second account first, then you can move money between them here.")}</p>
      ) : (
        <>
          <div className={css.field}>
            <label htmlFor="bh-from">{tx("From")}</label>
            <select id="bh-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {accts.map((a) => <option key={a.id} value={a.id}>{a.displayName || a.kind} · {sgd(a.availableBalance)}</option>)}
            </select>
          </div>
          <div className={css.field}>
            <label htmlFor="bh-to">{tx("To")}</label>
            <select id="bh-to" value={to} onChange={(e) => setTo(e.target.value)}>
              {accts.map((a) => <option key={a.id} value={a.id}>{a.displayName || a.kind}</option>)}
            </select>
          </div>
          <div className={css.field}>
            <label htmlFor="bh-amt">{tx("Amount")}</label>
            <input id="bh-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={tx("e.g. 200")} />
          </div>
          {msg ? <span className={css.err}>{msg}</span> : null}
          <button type="button" className={css.cta} disabled={busy} onClick={move}>{busy ? tx("Moving…") : tx("Move my money")}</button>
        </>
      )}
    </>
  );
}
function FxSheet() {
  const { tx } = useTx();
  return (
    <>
      <p className={css.sheetTitle}>{tx("Foreign Exchange")}</p>
      <p className={css.lede}><b>{tx("Indicative rate only.")}</b> {tx("No executable FX provider is connected to this preview, so Future Bank cannot quote or book a real conversion.")}</p>
      <p className={css.micro}>{tx("When a provider is connected, this is where a live quote, the spread and a book button would appear.")}</p>
    </>
  );
}
function ScanPaySheet() {
  const { tx } = useTx();
  return (
    <>
      <p className={css.sheetTitle}>{tx("Scan & Pay")}</p>
      <p className={css.lede}><b>{tx("Not connected.")}</b> {tx("Merchant QR payments need a payment rail this preview does not have. The camera is intentionally not opened.")}</p>
      <p className={css.micro}>{tx("Nothing here can move money until a real rail is connected.")}</p>
    </>
  );
}

// Future Echo — how one Today payment ripples along the Life line.
function EchoSheet({ txn, fb, twin }) {
  const { tx } = useTx();
  const s2s = twin?.safeToSpend ?? {};
  const echo = echoPayment({
    amount: txn?.amount,
    safeToSpend: s2s.safeToSpend,
    protectedReserve: s2s.breakdown?.protectedReserve ?? twin?.twin?.balanceBreakdown?.protectedFor,
    lifeThread: fb?.lifeThread ?? {},
  });
  return (
    <>
      <p className={css.sheetTitle}>{sgd(echo.amount)} · {txn?.merchant || tx("payment")}</p>
      <p className={css.micro}>{tx("How this one payment moves your line:")}</p>
      <div>
        {echo.lines.map((l) => (
          <div key={l.id} className={css.sheetKV}>
            <span>{l.tone === "down" ? "↓" : "•"}</span>
            <span>{tx(l.key, l.params)}</span>
          </div>
        ))}
      </div>
      <p className={css.micro}>{tx(echo.basis)}</p>
    </>
  );
}
