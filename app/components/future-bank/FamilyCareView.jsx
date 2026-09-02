"use client";

// Family & Care — the people around your money. Covers the whole family
// life cycle: a parent managing a child's money, a youth with a guardian
// who approves key actions, a household sharing agreed ranges, a trusted
// contact for emergencies, and a beneficiary for a later financial handoff.
//
// Built on the real lifecycle_roles store (GET/POST /api/account). Sensitive
// steps (a minor's account, elderly care, a handoff) are stated honestly:
// they need identity verification and the right legal steps, and Future
// Bank never infers a life event — you confirm it.

import { useCallback, useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";

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
const ROLE_CAN = {
  guardian: "Approves your key money actions.",
  dependent: "You manage their money and permissions.",
  household_member: "Sees agreed ranges only, never exact private amounts.",
  trusted_contact: "Emergency contact — no visibility by default.",
  beneficiary_placeholder: "Placeholder for a future handoff — not active until verified.",
  account_owner: "Full control of this account.",
};

const POST = (body) =>
  fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
    async (r) => ({ ok: r.ok, status: r.status, ...(await r.json().catch(() => ({}))) }),
  );

export function FamilyCareView({ onBack, onWedding }) {
  const [roles, setRoles] = useState(null);
  const [accountType, setAccountType] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, ob] = await Promise.all([
        fetch("/api/account?view=roles", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : { roles: [] })),
        fetch("/api/onboarding", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : null)),
      ]);
      setRoles(r.roles ?? []);
      setAccountType(ob?.onboarding?.accountType ?? null);
    } catch {
      setRoles([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async (role, scope) => {
    setBusy(true);
    setMsg("");
    const d = await POST({ action: "grant_role", role, scope });
    setBusy(false);
    if (d.ok) {
      setMsg("Added. You can send them an invite from Account when invites are connected.");
      load();
    } else {
      setMsg("Could not add that role. Try again.");
    }
  };
  const remove = async (roleId) => {
    setBusy(true);
    await POST({ action: "revoke_role", roleId });
    setBusy(false);
    load();
  };

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← Life</button>
        <div>
          <h1 className={css.title}>Family &amp; Care</h1>
          <p className={css.micro}>The people around your money — a child you manage, a guardian who approves, a household you share ranges with, an emergency contact, a beneficiary for later.</p>
        </div>

        {accountType && accountType !== "individual" ? (
          <p className={css.micro}>
            This is a <b>{accountType.replace(/_/g, " ")}</b> account.
            {accountType === "youth" ? " Key actions need a guardian's approval; permissions grow as rules allow." : ""}
            {accountType === "guardian_managed_child" ? " A minor's account is fully guardian-controlled." : ""}
          </p>
        ) : null}

        {/* current circle */}
        <section className={css.section}>
          <p className={css.kicker}>Your circle</p>
          {roles == null ? (
            <p className={css.micro}>Loading…</p>
          ) : roles.length === 0 ? (
            <p className={css.micro}>No one added yet. Add a guardian, a dependent, a household member, an emergency contact or a beneficiary below.</p>
          ) : (
            <div className={css.activity}>
              {roles.map((r) => (
                <div key={r.id} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{ROLE_LABEL[r.role] ?? r.role}{r.status !== "active" ? ` · ${r.status}` : ""}</span>
                    <span className={css.actMeta}>{ROLE_CAN[r.role] ?? r.scope}</span>
                  </span>
                  {r.role !== "account_owner" ? (
                    <button type="button" className={css.link} disabled={busy} onClick={() => remove(r.id)}>Remove</button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

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
            <li><span className={css.proofMark}>→</span> Future Bank never guesses a life event. Important stages are yours to confirm.</li>
            <li><span className={css.proofMark}>→</span> Sharing shows agreed ranges — never your exact private amounts.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
