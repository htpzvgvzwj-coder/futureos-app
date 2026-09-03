"use client";

// Family & Care — the people around your money, across the whole family
// life cycle: a parent managing a child's money, a youth with a guardian
// who approves key actions, a household sharing agreed ranges, a trusted
// contact for emergencies, and a beneficiary for a later financial handoff.
//
// Built on the real lifecycle_roles store + care_handoff_plans
// (GET/POST /api/account, POST /api/onboarding for the account type).
// Sensitive steps (a minor's account, elderly care, a handoff) are stated
// honestly: they need identity verification and the right legal steps, and
// Future Bank never infers a life event or carries out a handoff on its own.

import { useCallback, useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import { FeatureHistory } from "./FeatureHistory.jsx";

const ACCOUNT_TYPES = [
  { id: "individual", name: "Just me", means: "A normal adult account. No one else can see or approve." },
  { id: "youth", name: "Youth, with a guardian", means: "Everyday spending works; paying out, cards, FX, investing and loans need a guardian's approval." },
  { id: "guardian_managed_child", name: "A child I manage", means: "A minor's account. The guardian controls the money and every permission." },
  { id: "household", name: "A shared household", means: "Planned together. Members see agreed ranges — never your exact private amounts." },
];
const ACCOUNT_TYPE_LABEL = Object.fromEntries(ACCOUNT_TYPES.map((a) => [a.id, a.name]));

const ROLE_CARDS = [
  { role: "guardian", scope: "approve", name: "A guardian for me", why: "They approve my key money decisions. For a youth or supervised account." },
  { role: "dependent", scope: "manage", name: "Someone I manage", why: "I control the money and permissions for a child or a dependent adult." },
  { role: "household_member", scope: "view", name: "A household member", why: "We plan together. They see agreed ranges — never my exact private amounts." },
  { role: "trusted_contact", scope: "suggest", name: "A trusted contact", why: "Reachable in an emergency. Sees nothing about my money by default." },
  { role: "beneficiary_placeholder", scope: "view", name: "A beneficiary", why: "For a financial handoff later. Needs identity checks and legal steps before it is active." },
];
const ROLE_LABEL = {
  account_owner: "Account owner",
  guardian: "Guardian",
  dependent: "In my care",
  household_member: "Household member",
  trusted_contact: "Trusted contact",
  beneficiary_placeholder: "Beneficiary",
};
// roles that can be linked to a real second person via an invite code
const LINKABLE = new Set(["guardian", "trusted_contact", "household_member", "dependent"]);
const ROLE_CAN = {
  guardian: "Approves your key money actions.",
  dependent: "You manage their money and permissions.",
  household_member: "Sees agreed ranges only, never exact private amounts.",
  trusted_contact: "Emergency contact — no visibility by default.",
  beneficiary_placeholder: "Placeholder for a future handoff — not active until verified.",
  account_owner: "Full control of this account.",
};

// What a person can be "noted for" — plain-language money areas, not raw
// account ids. Stored as the `covers` array on the role.
const COVER_AREAS = [
  { id: "everyday_spending", label: "Everyday spending" },
  { id: "bills", label: "Bills & subscriptions" },
  { id: "savings", label: "Savings & goals" },
  { id: "emergency", label: "Emergency fund" },
  { id: "investments", label: "Investments" },
  { id: "property", label: "Property & big assets" },
  { id: "insurance", label: "Insurance & protection" },
  { id: "everything", label: "Everything (full picture)" },
];
const COVER_LABEL = Object.fromEntries(COVER_AREAS.map((c) => [c.id, c.label]));

const HANDOFF_KINDS = [
  { id: "general", label: "A general handoff" },
  { id: "retirement", label: "Retirement handoff" },
  { id: "incapacity", label: "If I can't manage it myself" },
];
const HANDOFF_KIND_LABEL = Object.fromEntries(HANDOFF_KINDS.map((k) => [k.id, k.label]));

const POST = (body) =>
  fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
    async (r) => ({ ok: r.ok, status: r.status, ...(await r.json().catch(() => ({}))) }),
  );
const POST_ONBOARDING = (body) =>
  fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
    async (r) => ({ ok: r.ok, status: r.status, ...(await r.json().catch(() => ({}))) }),
  );
const POST_AUTH = (body) =>
  fetch("/api/authorizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
    async (r) => ({ ok: r.ok, status: r.status, ...(await r.json().catch(() => ({}))) }),
  );
const POST_CARE = (body) =>
  fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
    async (r) => ({ ok: r.ok, status: r.status, ...(await r.json().catch(() => ({}))) }),
  );

export function FamilyCareView({ onBack, onWedding }) {
  const [roles, setRoles] = useState(null);
  const [accountType, setAccountType] = useState(null);
  const [handoff, setHandoff] = useState(undefined); // undefined = loading, null = none
  const [policy, setPolicy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(null); // roleId being edited
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [care, setCare] = useState(null);
  const [inviteCode, setInviteCode] = useState(null); // { roleId, code }
  const [acceptCode, setAcceptCode] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, ob, h, a, c] = await Promise.all([
        fetch("/api/account?view=roles", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : { roles: [] })),
        fetch("/api/onboarding", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : null)),
        fetch("/api/account?view=handoff", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : { handoff: null })),
        fetch("/api/authorizations", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : null)),
        fetch("/api/care", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : null)),
      ]);
      setRoles(r.roles ?? []);
      setAccountType(ob?.onboarding?.accountType ?? "individual");
      setHandoff(h.handoff ?? null);
      setPolicy(a?.policy ?? null);
      setCare(c ?? null);
    } catch {
      setRoles([]);
      setHandoff(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const changeType = async (id) => {
    if (id === accountType) return;
    setBusy(true);
    setMsg("");
    const d = await POST_ONBOARDING({ action: "set_account_type", accountType: id });
    setBusy(false);
    if (d.ok) {
      setAccountType(id);
      setMsg(`Account set to “${ACCOUNT_TYPE_LABEL[id]}”. What each person can do updates below.`);
    } else {
      setMsg("Could not change the account type. Try again.");
    }
  };

  const add = async (role, scope) => {
    setBusy(true);
    setMsg("");
    const d = await POST({ action: "grant_role", role, scope });
    setBusy(false);
    if (d.ok) {
      setMsg("Added. For a guardian, household member, dependent or trusted contact, use “Invite” on their row to link their real account — until then they have no access.");
      load();
    } else {
      setMsg("Could not add that role. Try again.");
    }
  };
  const remove = async (roleId) => {
    setBusy(true);
    // revoke through /api/care so an already-linked person is unlinked too
    await POST_CARE({ action: "revoke", roleId });
    setBusy(false);
    setEditing(null);
    setInviteCode((c) => (c?.roleId === roleId ? null : c));
    load();
  };
  const invite = async (roleId) => {
    setBusy(true);
    setMsg("");
    const d = await POST_CARE({ action: "invite", roleId });
    setBusy(false);
    if (d.ok && d.code) {
      setInviteCode({ roleId, code: d.code });
    } else {
      setMsg("Could not create an invite for that person.");
    }
  };
  const acceptInvite = async () => {
    setBusy(true);
    setMsg("");
    const d = await POST_CARE({ action: "accept", code: acceptCode.trim() });
    setBusy(false);
    if (d.ok) {
      setAcceptCode("");
      setMsg("Linked. You can now see their money health in Guardian → “People you look after”.");
      load();
    } else {
      setMsg(d.error ? `Could not accept: ${d.error}` : "Could not accept that code.");
    }
  };
  const saveRole = async (roleId, patch) => {
    setBusy(true);
    const d = await POST({ action: "update_role", roleId, ...patch });
    setBusy(false);
    if (d.ok) {
      setEditing(null);
      load();
    } else {
      setMsg("Could not save. Try again.");
    }
  };
  const careAction = async (body, okMsg) => {
    setBusy(true);
    setMsg("");
    const d = await POST_CARE(body);
    setBusy(false);
    if (d.ok) {
      if (okMsg) setMsg(okMsg);
      load();
    } else {
      setMsg(d.error ? `Could not: ${d.error}` : "Could not save. Try again.");
    }
  };
  const savePolicy = async (patch) => {
    setBusy(true);
    setMsg("");
    const d = await POST_AUTH({ action: "set_policy", ...patch });
    setBusy(false);
    if (d.ok) {
      setPolicy(d.policy);
      setMsg("Approval rules saved. Money moves that match will wait for a decision in Guardian.");
    } else {
      setMsg("Could not save the approval rules. Try again.");
    }
  };
  const saveHandoff = async (patch) => {
    setBusy(true);
    setMsg("");
    const d = await POST({ action: "set_handoff_plan", ...patch });
    setBusy(false);
    if (d.ok) {
      setHandoff(d.handoff);
      setHandoffOpen(false);
      setMsg("Handoff plan saved as a written note. Future Bank never carries it out on its own.");
    } else {
      setMsg("Could not save the handoff plan. Try again.");
    }
  };

  const circle = (roles ?? []).filter((r) => r.role !== "account_owner");
  const successorChoices = circle.filter((r) => ["guardian", "trusted_contact", "beneficiary_placeholder"].includes(r.role));
  const currentType = ACCOUNT_TYPES.find((a) => a.id === (accountType ?? "individual"));

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← Life</button>
        <div>
          <h1 className={css.title}>Family &amp; Care</h1>
          <p className={css.micro}>The people around your money — a child you manage, a guardian who approves, a household you share ranges with, an emergency contact, a beneficiary for later.</p>
        </div>

        {/* account setup */}
        <section className={css.section}>
          <p className={css.kicker}>Account setup</p>
          <p className={css.micro}>
            This account is <b>{currentType?.name ?? "Just me"}</b>. {currentType?.means}
          </p>
          <div className={css.choiceGrid}>
            {ACCOUNT_TYPES.map((a) => (
              <button
                key={a.id}
                type="button"
                className={css.choice}
                disabled={busy || a.id === accountType}
                aria-pressed={a.id === accountType}
                onClick={() => changeType(a.id)}
              >
                <b>{a.name}{a.id === accountType ? " ✓" : ""}</b>
                <span>{a.means}</span>
              </button>
            ))}
          </div>
        </section>

        {/* approval rules */}
        <section className={css.section}>
          <p className={css.kicker}>Approval rules</p>
          <ApprovalRules
            accountType={accountType ?? "individual"}
            policy={policy}
            busy={busy}
            onSave={savePolicy}
          />
        </section>

        {/* current circle */}
        <section className={css.section}>
          <p className={css.kicker}>Your circle</p>
          {roles == null ? (
            <p className={css.micro}>Loading…</p>
          ) : circle.length === 0 ? (
            <p className={css.micro}>No one added yet. Add a guardian, a dependent, a household member, an emergency contact or a beneficiary below.</p>
          ) : (
            <div className={css.activity}>
              {circle.map((r) =>
                editing === r.id ? (
                  <RoleEditor
                    key={r.id}
                    role={r}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={(patch) => saveRole(r.id, patch)}
                    onRemove={() => remove(r.id)}
                  />
                ) : (
                  <div key={r.id}>
                    <div className={css.actItem}>
                      <span className={css.actBody}>
                        <span className={css.actName}>
                          {r.relationLabel ? r.relationLabel : ROLE_LABEL[r.role] ?? r.role}
                          {r.status === "active" && r.subjectKey ? " · linked" : r.status !== "active" ? ` · ${r.status}` : ""}
                        </span>
                        <span className={css.actMeta}>
                          {ROLE_LABEL[r.role] ?? r.role} — {ROLE_CAN[r.role] ?? r.scope}
                          {r.covers?.length ? ` · noted for: ${r.covers.map((c) => COVER_LABEL[c] ?? c).join(", ")}` : ""}
                          {r.note ? ` · ${r.note}` : ""}
                        </span>
                      </span>
                      {LINKABLE.has(r.role) && r.status === "pending" ? (
                        <button type="button" className={css.link} disabled={busy} onClick={() => invite(r.id)}>Invite</button>
                      ) : null}
                      <button type="button" className={css.link} disabled={busy} onClick={() => setEditing(r.id)}>Edit</button>
                    </div>
                    {inviteCode?.roleId === r.id ? (
                      <div className={css.calmCard}>
                        <b>One-time invite code</b>
                        <span className={css.bigAmount} style={{ fontSize: "20px", letterSpacing: "1px" }}>{inviteCode.code}</span>
                        <span className={css.micro}>
                          Give this to {r.relationLabel || "them"} once. They open FutureOS, go to Family &amp; Care → “Someone invited you?”, and enter it. It expires in 14 days and works a single time. It is not shown again.
                        </span>
                      </div>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        {/* accept an invite someone sent me */}
        <section className={css.section}>
          <p className={css.kicker}>Someone invited you?</p>
          <div className={css.field}>
            <label htmlFor="fc-accept">Enter their invite code</label>
            <input
              id="fc-accept"
              type="text"
              value={acceptCode}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              onChange={(e) => setAcceptCode(e.target.value.toUpperCase())}
            />
          </div>
          <button type="button" className={css.cta} disabled={busy || acceptCode.trim().length < 8} onClick={acceptInvite}>Link my account to theirs</button>
          <p className={css.micro}>You will be able to see their money health only — never their transactions or exact balances. Either of you can end it at any time.</p>
        </section>

        {/* who can see this account */}
        {care?.supervisors?.length ? (
          <section className={css.section}>
            <p className={css.kicker}>Who can see this account</p>
            <div className={css.activity}>
              {care.supervisors.map((s) => (
                <div key={s.roleId}>
                  <div className={css.actItem}>
                    <span className={css.actBody}>
                      <span className={css.actName}>{s.personLabel}</span>
                      <span className={css.actMeta}>{ROLE_LABEL[s.role] ?? s.role} · {s.scope === "approve" ? "sees health + approves what you send" : "sees your money health only"}</span>
                    </span>
                    <button type="button" className={css.link} disabled={busy} onClick={() => careAction({ action: "nudge", roleId: s.roleId, title: "Please check in on my account when you can" }, `Asked ${s.personLabel} to take a look.`)}>Ask to check in</button>
                    <button type="button" className={css.link} disabled={busy} onClick={() => remove(s.roleId)}>Unlink</button>
                  </div>
                  {s.scope === "approve" ? (
                    <AllowanceEditor
                      person={s.personLabel}
                      current={s.autoApproveWeekly}
                      busy={busy}
                      onSave={async (weekly) => {
                        setBusy(true);
                        await POST_CARE({ action: "set_allowance", roleId: s.roleId, weekly });
                        setBusy(false);
                        load();
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <p className={css.micro}>They never see your transactions or exact balances. Unlinking takes effect immediately.</p>
          </section>
        ) : null}

        {/* shared ranges - what a household member sees instead of exact amounts */}
        <section className={css.section}>
          <p className={css.kicker}>Shared ranges</p>
          <p className={css.micro}>Household members see a range you set here — never an exact figure. Leave this empty and they only see your money-health state.</p>
          <SharedRanges
            ranges={care?.sharedRanges ?? []}
            busy={busy}
            onSave={(r) => careAction({ action: "set_range", ...r }, "Range saved.")}
            onDelete={(category) => careAction({ action: "delete_range", category }, "Range removed.")}
          />
        </section>

        {/* age & permissions - youth account transition proposals */}
        {(accountType === "youth" || accountType === "guardian_managed_child" || (care?.transitions?.length ?? 0) > 0) ? (
          <section className={css.section}>
            <p className={css.kicker}>Age &amp; permissions</p>
            <AgeAndPermissions
              birthYear={care?.birthYear ?? null}
              transitions={care?.transitions ?? []}
              busy={busy}
              onSaveYear={(year) => careAction({ action: "set_birth_year", year }, "Saved. Any due proposals appear below.")}
              onDecide={(id, apply) => careAction({ action: "transition", id, apply }, apply ? "Applied — check the approval rules above." : "Dismissed.")}
            />
          </section>
        ) : null}

        {/* add someone */}
        <section className={css.section}>
          <p className={css.kicker}>Add someone</p>
          <div className={css.choiceGrid}>
            {ROLE_CARDS.map((c) => (
              <button key={c.role} type="button" className={css.choice} disabled={busy} onClick={() => add(c.role, c.scope)}>
                <b>{c.name}</b>
                <span>{c.why}</span>
              </button>
            ))}
          </div>
          {msg ? <p className={css.micro}>{msg}</p> : null}
        </section>

        {/* handoff plan */}
        <section className={css.section}>
          <p className={css.kicker}>If something happens — your handoff plan</p>
          {handoff === undefined ? (
            <p className={css.micro}>Loading…</p>
          ) : handoff && !handoffOpen ? (
            <div className={css.calmCard}>
              <b>{HANDOFF_KIND_LABEL[handoff.kind] ?? "A handoff"} — written down</b>
              <span className={css.micro}>
                {handoff.successorLabel ? `Successor: ${handoff.successorLabel}. ` : ""}
                {handoff.triggerNote ? `When: ${handoff.triggerNote}. ` : ""}
                {handoff.instructions ? handoff.instructions : "No instructions added yet."}
              </span>
              {(() => {
                const succ = (roles ?? []).find((r) => r.id === handoff.successorRoleId);
                if (succ && succ.status === "active" && succ.subjectKey) {
                  return <span className={css.micro}>✓ {succ.relationLabel || ROLE_LABEL[succ.role] || "This person"} is linked and ready to take over — the handoff itself still needs the legal steps.</span>;
                }
                if (handoff.successorRoleId) {
                  return <span className={css.micro}>Your chosen successor is not linked yet. Invite them on their row above so they are ready.</span>;
                }
                return null;
              })()}
              <span className={css.micro}>Status: {handoff.status} — Future Bank never carries this out on its own. A real handoff needs identity checks and the right legal steps.</span>
              <button type="button" className={css.link} onClick={() => setHandoffOpen(true)}>Edit the plan</button>
            </div>
          ) : handoffOpen ? (
            <HandoffEditor
              busy={busy}
              handoff={handoff}
              successorChoices={successorChoices}
              onCancel={() => setHandoffOpen(false)}
              onSave={saveHandoff}
            />
          ) : (
            <div className={css.calmCard}>
              <b>No handoff plan yet.</b>
              <span className={css.micro}>Write down who should take over this account, when, and what they should know. It stays a note until you complete the real legal steps.</span>
              <button type="button" className={css.link} onClick={() => setHandoffOpen(true)}>Write a handoff plan</button>
            </div>
          )}
        </section>

        {/* family plans */}
        <section className={css.section}>
          <p className={css.kicker}>Family plans</p>
          <button type="button" className={css.choice} onClick={onWedding}>
            <b>Plan a wedding together</b>
            <span>Weigh guest count and budget against your other goals — and share only the agreed range.</span>
          </button>
        </section>

        <section className={css.section}>
          <p className={css.kicker}>How this stays safe</p>
          <ul className={css.proofList}>
            <li><span className={css.proofMark}>→</span> A minor&apos;s account is controlled by a parent or legal guardian.</li>
            <li><span className={css.proofMark}>→</span> Youth permissions change with age, consent and local rules — not automatically.</li>
            <li><span className={css.proofMark}>→</span> Elderly care and any handoff need identity verification and the right legal steps.</li>
            <li><span className={css.proofMark}>→</span> Future Bank never guesses a life event, and never carries out a handoff on its own.</li>
            <li><span className={css.proofMark}>→</span> This works both ways — an adult child can be the guardian or trusted contact for an ageing parent&apos;s account, with the same limits.</li>
            <li><span className={css.proofMark}>→</span> Sharing shows agreed ranges — never your exact private amounts.</li>
          </ul>
        </section>

        <FeatureHistory feature="family" label="What you've set up in Family & Care" />
      </div>
    </div>
  );
}

const RANGE_CATS = [
  { id: "rent", label: "Rent / housing" },
  { id: "groceries", label: "Groceries" },
  { id: "transport", label: "Transport" },
  { id: "utilities", label: "Utilities" },
  { id: "savings", label: "Savings" },
  { id: "childcare", label: "Childcare" },
  { id: "other", label: "Other" },
];
const RANGE_LABEL = Object.fromEntries(RANGE_CATS.map((c) => [c.id, c.label]));

function SharedRanges({ ranges, busy, onSave, onDelete }) {
  const [cat, setCat] = useState("rent");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const valid = low.trim() !== "" && high.trim() !== "" && Number(high) >= Number(low);
  return (
    <>
      {ranges.length > 0 ? (
        <div className={css.activity}>
          {ranges.map((r) => (
            <div key={r.category} className={css.actItem}>
              <span className={css.actBody}>
                <span className={css.actName}>{RANGE_LABEL[r.category] ?? r.category}</span>
                <span className={css.actMeta}>SGD {r.low.toLocaleString("en-SG")}–{r.high.toLocaleString("en-SG")}{r.note ? ` · ${r.note}` : ""}</span>
              </span>
              <button type="button" className={css.link} disabled={busy} onClick={() => onDelete(r.category)}>Remove</button>
            </div>
          ))}
        </div>
      ) : null}
      <div className={css.choiceGrid}>
        {RANGE_CATS.map((c) => (
          <button key={c.id} type="button" className={css.choice} aria-pressed={cat === c.id} disabled={busy} onClick={() => setCat(c.id)}>
            <b>{cat === c.id ? "✓ " : ""}{c.label}</b>
          </button>
        ))}
      </div>
      <div className={css.field}>
        <label htmlFor="sr-low">Low (SGD)</label>
        <input id="sr-low" inputMode="numeric" value={low} disabled={busy} onChange={(e) => setLow(e.target.value.replace(/[^\d]/g, ""))} />
      </div>
      <div className={css.field}>
        <label htmlFor="sr-high">High (SGD)</label>
        <input id="sr-high" inputMode="numeric" value={high} disabled={busy} onChange={(e) => setHigh(e.target.value.replace(/[^\d]/g, ""))} />
      </div>
      <button
        type="button"
        className={css.cta}
        disabled={busy || !valid}
        onClick={() => { onSave({ category: cat, low: Number(low), high: Number(high) }); setLow(""); setHigh(""); }}
      >
        Save this range
      </button>
    </>
  );
}

const MILESTONE_LABEL = { turns_16: "Turned 16", turns_18: "Turned 18", custom: "A milestone" };

function AgeAndPermissions({ birthYear, transitions, busy, onSaveYear, onDecide }) {
  const [year, setYear] = useState(birthYear != null ? String(birthYear) : "");
  useEffect(() => setYear(birthYear != null ? String(birthYear) : ""), [birthYear]);
  const dirty = year.trim() !== "" && Number(year) !== birthYear && Number(year) >= 1900 && Number(year) <= new Date().getFullYear();
  return (
    <>
      <p className={css.micro}>
        A birth year lets Future Bank <b>propose</b> loosening the rules at 16 and 18 — it never changes anything by itself; you apply or dismiss each proposal.
      </p>
      <div className={css.field}>
        <label htmlFor="ap-year">Birth year (optional)</label>
        <input id="ap-year" inputMode="numeric" value={year} placeholder="e.g. 2009" disabled={busy} onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} />
      </div>
      {dirty ? (
        <button type="button" className={css.link} disabled={busy} onClick={() => onSaveYear(Number(year))}>Save birth year</button>
      ) : null}
      {transitions.map((tr) => (
        <div key={tr.id} className={css.movingCard}>
          <div className={css.movingHead}><b>{MILESTONE_LABEL[tr.milestone] ?? tr.milestone}</b></div>
          <span className={css.micro}>{tr.rationale}</span>
          <div className={css.choiceGrid}>
            <button type="button" className={css.cta} disabled={busy} onClick={() => onDecide(tr.id, true)}>Apply this change</button>
            <button type="button" className={css.choice} disabled={busy} onClick={() => onDecide(tr.id, false)}>Not now</button>
          </div>
        </div>
      ))}
      {transitions.length === 0 ? <p className={css.micro}>No proposals right now.</p> : null}
    </>
  );
}

function AllowanceEditor({ person, current, busy, onSave }) {
  const [val, setVal] = useState(current != null ? String(current) : "");
  useEffect(() => setVal(current != null ? String(current) : ""), [current]);
  const dirty = (val.trim() === "" ? current != null : Number(val) !== current);
  return (
    <div className={css.field} style={{ paddingLeft: "10px" }}>
      <label htmlFor={`allow-${person}`}>Let {person} auto-approve up to (SGD / week)</label>
      <input
        id={`allow-${person}`}
        inputMode="numeric"
        value={val}
        placeholder="blank = they approve everything"
        disabled={busy}
        onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ""))}
      />
      {dirty ? (
        <button type="button" className={css.link} disabled={busy} onClick={() => onSave(val.trim() === "" ? null : Number(val))}>
          Save allowance
        </button>
      ) : null}
      <span className={css.micro}>Small moves under this run without asking; anything above still waits. You are delegating a limited pre-approval.</span>
    </div>
  );
}

function ApprovalRules({ accountType, policy, busy, onSave }) {
  const supervised = accountType === "youth" || accountType === "guardian_managed_child";
  const [restricted, setRestricted] = useState(true);
  const [over, setOver] = useState("");
  const [mode, setMode] = useState("approval");
  const [hours, setHours] = useState("48");
  const [both, setBoth] = useState(false);
  useEffect(() => {
    if (policy) {
      setRestricted(policy.restrictedNeedApproval);
      setOver(policy.approvalOverAmount != null ? String(policy.approvalOverAmount) : "");
      setMode(policy.mode ?? "approval");
      setHours(String(policy.coolingOffHours ?? 48));
      setBoth(Boolean(policy.requireBoth));
    }
  }, [policy]);
  if (!policy) return <p className={css.micro}>Loading…</p>;
  const dirty =
    restricted !== policy.restrictedNeedApproval ||
    (over.trim() === "" ? policy.approvalOverAmount != null : Number(over) !== policy.approvalOverAmount) ||
    mode !== (policy.mode ?? "approval") ||
    Number(hours) !== (policy.coolingOffHours ?? 48) ||
    both !== Boolean(policy.requireBoth);
  return (
    <>
      <p className={css.micro}>
        When a rule matches, a real money move (a transfer between your own accounts, a card repayment) is held instead of happening straight away. Nothing else is affected.
      </p>
      <label className={css.actItem} style={{ cursor: "pointer" }}>
        <span className={css.actBody}>
          <span className={css.actName}>Supervised actions need approval</span>
          <span className={css.actMeta}>
            {supervised
              ? "This is a supervised account, so paying out, cards, FX, investing and loans need a guardian's approval."
              : "Only applies while this is a youth or child account."}
          </span>
        </span>
        <input type="checkbox" checked={restricted} disabled={busy} onChange={(e) => setRestricted(e.target.checked)} />
      </label>
      <div className={css.field}>
        <label htmlFor="ap-over">Also check any move over (SGD)</label>
        <input
          id="ap-over"
          inputMode="numeric"
          value={over}
          placeholder="e.g. 2000 — leave blank for no amount rule"
          disabled={busy}
          onChange={(e) => setOver(e.target.value.replace(/[^\d]/g, ""))}
        />
      </div>

      <p className={css.micro}>When a move is held:</p>
      <div className={css.choiceGrid}>
        <button type="button" className={css.choice} aria-pressed={mode === "approval"} disabled={busy} onClick={() => setMode("approval")}>
          <b>{mode === "approval" ? "✓ " : ""}Wait for a decision</b>
          <span>It only happens once someone approves it.</span>
        </button>
        <button type="button" className={css.choice} aria-pressed={mode === "cooling_off"} disabled={busy} onClick={() => setMode("cooling_off")}>
          <b>{mode === "cooling_off" ? "✓ " : ""}Cooling-off</b>
          <span>It runs itself after a wait, unless someone stops it. No one has to be online.</span>
        </button>
      </div>
      {mode === "cooling_off" ? (
        <div className={css.field}>
          <label htmlFor="ap-hours">Cooling-off wait (hours)</label>
          <input id="ap-hours" inputMode="numeric" value={hours} disabled={busy} onChange={(e) => setHours(e.target.value.replace(/[^\d]/g, "") || "")} />
        </div>
      ) : null}

      <label className={css.actItem} style={{ cursor: "pointer" }}>
        <span className={css.actBody}>
          <span className={css.actName}>Two people must agree</span>
          <span className={css.actMeta}>A held move needs both a guardian&apos;s approval and your own confirmation before it runs.</span>
        </span>
        <input type="checkbox" checked={both} disabled={busy} onChange={(e) => setBoth(e.target.checked)} />
      </label>

      <button
        type="button"
        className={css.cta}
        disabled={busy || !dirty}
        onClick={() =>
          onSave({
            restrictedNeedApproval: restricted,
            approvalOverAmount: over.trim() === "" ? null : Number(over),
            mode,
            coolingOffHours: hours.trim() === "" ? 48 : Number(hours),
            requireBoth: both,
          })
        }
      >
        Save approval rules
      </button>
      <p className={css.micro}>An amount rule plus cooling-off protects an older adult who wants a pause before a large transfer, without needing anyone else to act.</p>
    </>
  );
}

function RoleEditor({ role, busy, onCancel, onSave, onRemove }) {
  const [relationLabel, setRelationLabel] = useState(role.relationLabel ?? "");
  const [note, setNote] = useState(role.note ?? "");
  const [covers, setCovers] = useState(new Set(role.covers ?? []));
  const toggle = (id) => {
    const next = new Set(covers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCovers(next);
  };
  return (
    <div className={css.movingCard}>
      <div className={css.movingHead}><b>{ROLE_LABEL[role.role] ?? role.role}</b></div>
      <div className={css.field}>
        <label htmlFor={`rel-${role.id}`}>Who they are</label>
        <input id={`rel-${role.id}`} type="text" value={relationLabel} maxLength={80} placeholder="e.g. My mother, My son Aaron" onChange={(e) => setRelationLabel(e.target.value)} />
      </div>
      <p className={css.micro}>Noted for</p>
      <div className={css.choiceGrid}>
        {COVER_AREAS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={css.choice}
            aria-pressed={covers.has(c.id)}
            onClick={() => toggle(c.id)}
          >
            <b>{covers.has(c.id) ? "✓ " : ""}{c.label}</b>
          </button>
        ))}
      </div>
      <div className={css.field}>
        <label htmlFor={`note-${role.id}`}>Note (optional)</label>
        <input id={`note-${role.id}`} type="text" value={note} maxLength={140} placeholder="e.g. only for the joint bills account" onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className={css.choiceGrid}>
        <button type="button" className={css.cta} disabled={busy} onClick={() => onSave({ relationLabel, note, covers: [...covers] })}>Save</button>
        <button type="button" className={css.choice} disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className={css.link} disabled={busy} onClick={onRemove}>Remove from circle</button>
      </div>
      <p className={css.micro}>“Noted for” is your own reference. It does not grant access — access needs an accepted invite and the right permission.</p>
    </div>
  );
}

function HandoffEditor({ busy, handoff, successorChoices, onCancel, onSave }) {
  const [kind, setKind] = useState(handoff?.kind ?? "general");
  const [successorRoleId, setSuccessorRoleId] = useState(handoff?.successorRoleId ?? "");
  const [triggerNote, setTriggerNote] = useState(handoff?.triggerNote ?? "");
  const [instructions, setInstructions] = useState(handoff?.instructions ?? "");
  const chosen = successorChoices.find((r) => r.id === successorRoleId);
  return (
    <div className={css.movingCard}>
      <div className={css.movingHead}><b>Write a handoff plan</b></div>
      <p className={css.micro}>Kind</p>
      <div className={css.choiceGrid}>
        {HANDOFF_KINDS.map((k) => (
          <button key={k.id} type="button" className={css.choice} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
            <b>{kind === k.id ? "✓ " : ""}{k.label}</b>
          </button>
        ))}
      </div>
      <p className={css.micro}>Who should take over</p>
      {successorChoices.length === 0 ? (
        <p className={css.micro}>Add a guardian, trusted contact or beneficiary to your circle first, then choose them here.</p>
      ) : (
        <div className={css.choiceGrid}>
          {successorChoices.map((r) => (
            <button
              key={r.id}
              type="button"
              className={css.choice}
              aria-pressed={successorRoleId === r.id}
              onClick={() => setSuccessorRoleId(r.id)}
            >
              <b>{successorRoleId === r.id ? "✓ " : ""}{r.relationLabel || ROLE_LABEL[r.role] || r.role}</b>
              <span>{ROLE_LABEL[r.role]}</span>
            </button>
          ))}
        </div>
      )}
      <div className={css.field}>
        <label htmlFor="ho-trigger">When this plan should apply</label>
        <input id="ho-trigger" type="text" value={triggerNote} maxLength={140} placeholder="e.g. if I'm hospitalised for more than 2 weeks" onChange={(e) => setTriggerNote(e.target.value)} />
      </div>
      <div className={css.field}>
        <label htmlFor="ho-instructions">What they should know / do</label>
        <input id="ho-instructions" type="text" value={instructions} maxLength={280} placeholder="e.g. keep the bills paid from the joint account; the emergency fund is for medical costs" onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div className={css.choiceGrid}>
        <button
          type="button"
          className={css.cta}
          disabled={busy}
          onClick={() =>
            onSave({
              kind,
              successorRoleId: successorRoleId || null,
              successorLabel: chosen ? chosen.relationLabel || ROLE_LABEL[chosen.role] || chosen.role : null,
              triggerNote,
              instructions,
            })
          }
        >
          Save as a written plan
        </button>
        <button type="button" className={css.choice} disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      <p className={css.micro}>This is only a note. Future Bank never carries it out on its own — a real handoff needs identity checks and the right legal steps.</p>
    </div>
  );
}
