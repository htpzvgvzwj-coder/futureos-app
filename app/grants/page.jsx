"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SCOPE_OPTIONS = ["all", "wedding", "home", "retirement", "other", "hardship", "loan", "investment"];

export default function GrantsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [given, setGiven] = useState([]);
  const [received, setReceived] = useState([]);
  const [granteeEmail, setGranteeEmail] = useState("");
  const [scope, setScope] = useState("all");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadGrants = () => {
    fetch("/api/grants")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        setGiven(data.given);
        setReceived(data.received);
      })
      .catch(() => router.push("/login"));
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? Promise.resolve() : Promise.reject(response)))
      .then(() => {
        setAuthChecked(true);
        loadGrants();
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
        body: JSON.stringify({ granteeEmail, scope, accessLevel: "view" }),
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
