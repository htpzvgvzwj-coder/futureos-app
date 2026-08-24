"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SCOPE_OPTIONS = ["all", "wedding", "home", "retirement", "other", "hardship", "loan", "investment"];
const ACCESS_LEVEL_OPTIONS = [
  { value: "view", label: "View only" },
  { value: "view_and_act", label: "View and jointly decide (e.g. confirm a wedding, home, retirement, or other goal plan together)" },
];

function formatSgd(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `SGD ${n.toLocaleString("en-SG")}` : "SGD 0";
}

const DOMAIN_LABELS = { wedding: "Wedding", home: "Home", retirement: "Retirement", other: "Other goal" };

// Plain-language summary of a pending joint action's payload - shapes vary
// by action_type (see lib/goal-plan-actions.js for the full domain
// registry). Every "confirm_<domain>_plan" action_type shares the same two
// real kinds: "budget"/"plan" (stage1) and "savings_plan" (stage2, whose
// monthly_contribution/start_month/target_complete_month fields are
// uniform across all four domains - lib/{wedding,home,retirement,other}-
// validation.js's finalize schemas all use the exact same names).
function describeJointAction(action) {
  const domainLabel = DOMAIN_LABELS[action.domain] ?? action.domain;
  if (action.action_type.startsWith("confirm_") && action.action_type.endsWith("_plan")) {
    if (action.payload.kind === "budget") {
      return `${domainLabel} budget: ${formatSgd(action.payload.total_budget)} for a wedding on ${action.payload.wedding_date}`;
    }
    if (action.payload.kind === "plan") {
      return `${domainLabel} plan confirmed and proposed for your joint decision.`;
    }
    if (action.payload.kind === "savings_plan") {
      return `${domainLabel} savings plan: ${formatSgd(action.payload.monthly_contribution)}/month, ${action.payload.start_month} to ${action.payload.target_complete_month}`;
    }
  }
  if (action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan") {
    return `${domainLabel}: change monthly contribution to ${formatSgd(action.payload.newMonthlyContribution)} - ${action.payload.explanation}`;
  }
  return `${domainLabel} / ${action.action_type}`;
}

export default function GrantsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [given, setGiven] = useState([]);
  const [received, setReceived] = useState([]);
  const [pendingJointActions, setPendingJointActions] = useState([]);
  const [granteeEmail, setGranteeEmail] = useState("");
  const [scope, setScope] = useState("all");
  const [accessLevel, setAccessLevel] = useState("view");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [jointActionBusyId, setJointActionBusyId] = useState(null);

  const loadGrants = () => {
    fetch("/api/grants")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        setGiven(data.given);
        setReceived(data.received);
      })
      .catch(() => router.push("/login"));
  };

  const loadPendingJointActions = () => {
    fetch("/api/joint-actions")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => setPendingJointActions(data.pending ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? Promise.resolve() : Promise.reject(response)))
      .then(() => {
        setAuthChecked(true);
        loadGrants();
        loadPendingJointActions();
      })
      .catch(() => router.push("/login"));
  }, []);

  const createGrant = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granteeEmail, scope, accessLevel }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          data.error === "grantee_not_found"
            ? "No FutureOS account with that email."
            : data.error === "cannot_grant_self"
              ? "You can't share access with yourself."
              : "Something went wrong."
        );
        return;
      }
      setGranteeEmail("");
      loadGrants();
    } finally {
      setSubmitting(false);
    }
  };

  const respond = async (id, decision) => {
    await fetch(`/api/grants/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadGrants();
  };

  const revoke = async (id) => {
    await fetch(`/api/grants/${id}/revoke`, { method: "POST" });
    loadGrants();
  };

  const confirmJointAction = async (id) => {
    setJointActionBusyId(id);
    try {
      await fetch(`/api/joint-actions/${id}/confirm`, { method: "POST" });
      loadPendingJointActions();
    } finally {
      setJointActionBusyId(null);
    }
  };

  const declineJointAction = async (id) => {
    setJointActionBusyId(id);
    try {
      await fetch(`/api/joint-actions/${id}/decline`, { method: "POST" });
      loadPendingJointActions();
    } finally {
      setJointActionBusyId(null);
    }
  };

  if (!authChecked) return null;

  return (
    <main className="stage theme-light">
      <section className="phone" aria-label="Shared access">
        <div style={{ padding: "24px 20px", display: "grid", gap: "18px" }}>
          <button type="button" className="secondaryButton" onClick={() => router.push("/")}>
            Back
          </button>

          <div className="pageHeader">
            <h1>Shared access</h1>
            <p>
              Give a family member view access to your FutureOS data - a real family member monitoring a parent's
              account, or a couple sharing visibility on joint goals. They must accept before they can see anything,
              and you can revoke at any time.
            </p>
          </div>

          <form onSubmit={createGrant} style={{ display: "grid", gap: "10px" }}>
            <label className="inputField">
              <span>Their email</span>
              <input type="email" value={granteeEmail} onChange={(event) => setGranteeEmail(event.target.value)} required />
            </label>
            <label className="inputField">
              <span>What can they see</span>
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "Everything" : option}
                  </option>
                ))}
              </select>
            </label>
            <label className="inputField">
              <span>Access level</span>
              <select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)}>
                {ACCESS_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <section className="adviceOnlyPanel">
                <p>{error}</p>
              </section>
            ) : null}
            <button type="submit" className="primaryButton" disabled={submitting}>
              {submitting ? "Sending..." : "Send invite"}
            </button>
          </form>

          <section className="financialStrategyPanel">
            <span className="sectionLabel">Pending joint decisions</span>
            <div className="strategyList">
              {pendingJointActions.length ? (
                pendingJointActions.map((action) => (
                  <article className="strategyItem" key={action.id}>
                    <div>
                      <strong>{action.initiator_display_name} proposed:</strong>
                      <small>{describeJointAction(action)}</small>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="miniButton"
                        disabled={jointActionBusyId === action.id}
                        onClick={() => confirmJointAction(action.id)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="miniButton danger"
                        disabled={jointActionBusyId === action.id}
                        onClick={() => declineJointAction(action.id)}
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p>Nothing waiting on your confirmation right now.</p>
              )}
            </div>
          </section>

          <section className="financialStrategyPanel">
            <span className="sectionLabel">Access you've given</span>
            <div className="strategyList">
              {given.length ? (
                given.map((grant) => (
                  <article className="strategyItem" key={grant.id}>
                    <div>
                      <strong>{grant.grantee_display_name}</strong>
                      <small>
                        {grant.grantee_email} - {grant.scope} - {grant.status}
                      </small>
                    </div>
                    {grant.status === "active" ? (
                      <button type="button" className="miniButton danger" onClick={() => revoke(grant.id)}>
                        Revoke
                      </button>
                    ) : null}
                  </article>
                ))
              ) : (
                <p>You haven&apos;t shared access with anyone yet.</p>
              )}
            </div>
          </section>

          <section className="financialStrategyPanel">
            <span className="sectionLabel">Access shared with you</span>
            <div className="strategyList">
              {received.length ? (
                received.map((grant) => (
                  <article className="strategyItem" key={grant.id}>
                    <div>
                      <strong>{grant.grantor_display_name}</strong>
                      <small>
                        {grant.grantor_email} - {grant.scope} - {grant.status}
                      </small>
                    </div>
                    {grant.status === "pending" ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="button" className="miniButton" onClick={() => respond(grant.id, "accept")}>
                          Accept
                        </button>
                        <button type="button" className="miniButton danger" onClick={() => respond(grant.id, "decline")}>
                          Decline
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p>No one has shared access with you yet.</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
