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

export function FamilyCareView({ onBack, onWedding }) {
  const [roles, setRoles] = useState(null);
  const [accountType, setAccountType] = useState(null);
  const [handoff, setHandoff] = useState(undefined); // undefined = loading, null = none
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(null); // roleId being edited
  const [handoffOpen, setHandoffOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, ob, h] = await Promise.all([
        fetch("/api/account?view=roles", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : { roles: [] })),
        fetch("/api/onboarding", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : null)),
        fetch("/api/account?view=handoff", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : { handoff: null })),
      ]);
      setRoles(r.roles ?? []);
      setAccountType(ob?.onboarding?.accountType ?? "individual");
      setHandoff(h.handoff ?? null);
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
      setMsg("Added as a placeholder. Send them an invite from Account once invites are connected — until then they have no access.");
      load();
    } else {
      setMsg("Could not add that role. Try again.");
    }
  };
  const remove = async (roleId) => {
    setBusy(true);
    await POST({ action: "revoke_role", roleId });
    setBusy(false);
    setEditing(null);
    load();
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
                  <div key={r.id} className={css.actItem}>
                    <span className={css.actBody}>
                      <span className={css.actName}>
                        {r.relationLabel ? r.relationLabel : ROLE_LABEL[r.role] ?? r.role}
                        {r.status !== "active" ? ` · ${r.status}` : ""}
                      </span>
                      <span className={css.actMeta}>
                        {ROLE_LABEL[r.role] ?? r.role} — {ROLE_CAN[r.role] ?? r.scope}
                        {r.covers?.length ? ` · noted for: ${r.covers.map((c) => COVER_LABEL[c] ?? c).join(", ")}` : ""}
                        {r.note ? ` · ${r.note}` : ""}
                      </span>
                    </span>
                    <button type="button" className={css.link} disabled={busy} onClick={() => setEditing(r.id)}>Edit</button>
                  </div>
                ),
              )}
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
            <li><span className={css.proofMark}>→</span> Sharing shows agreed ranges — never your exact private amounts.</li>
          </ul>
        </section>
      </div>
    </div>
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
