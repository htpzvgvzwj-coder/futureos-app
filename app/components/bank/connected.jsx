"use client";

// Connectors so app/page.jsx can drop the bank surfaces into its screen map
// without threading data - they read useBankData() themselves (they render
// inside <BankDataProvider>).

import { useEffect } from "react";

import { useBankData } from "./useBankData.jsx";
import { BankTodayHeader } from "./BankTodayHeader.jsx";
import { GuardianSections } from "./GuardianSections.jsx";
import { CurrentRippleStrip } from "./CurrentRippleStrip.jsx";
import { OnboardingWizard } from "./OnboardingWizard.jsx";
import { RealityEntry } from "./RealityEntry.jsx";
import { CsvImportWizard } from "./CsvImportWizard.jsx";
import { AccountControl } from "./AccountControl.jsx";
import { MoneyRescuePanel } from "./MoneyRescuePanel.jsx";
import { RealityDriftPanel } from "./RealityDriftPanel.jsx";

export function BankTodayConnected({ onOpen, onRippleAction }) {
  const { twin, ripple, status } = useBankData();
  return <BankTodayHeader twin={twin} ripple={ripple} status={status} onOpen={onOpen} onRippleAction={onRippleAction} />;
}

export function GuardianConnected({ onOpen, onControl }) {
  const { twin, ripple } = useBankData();
  return <GuardianSections twin={twin} ripple={ripple} onOpen={onOpen} onControl={onControl} />;
}

export function RippleStripConnected({ onAction, compact = true }) {
  const { ripple } = useBankData();
  return <CurrentRippleStrip ripple={ripple} onAction={onAction} compact={compact} />;
}

// The onboarding gate: a brand-new user (onboarding not complete) sees the
// wizard instead of the app. Returns null once complete so the caller
// renders the real screen.
export function OnboardingGate({ onOpen, onGateChange, children }) {
  const { onboarding, status, reload } = useBankData();
  const ob = onboarding?.onboarding ?? null;
  const loading = status === "loading" || status === "idle";
  const gated = loading || Boolean(ob && ob.status !== "complete");

  useEffect(() => {
    onGateChange?.(gated);
  }, [gated, onGateChange]);

  if (loading) return null; // keep the app chrome quiet until the gate is known
  if (gated) {
    return <OnboardingWizard onComplete={reload} onOpen={onOpen} />;
  }
  return children ?? null;
}

export function RealityEntryConnected({ onDone, onOpen }) {
  const { invalidate } = useBankData();
  return (
    <RealityEntry
      onOpen={onOpen}
      onDone={() => {
        invalidate();
        onDone?.();
      }}
    />
  );
}

export function CsvImportConnected({ onDone }) {
  const { invalidate } = useBankData();
  return (
    <CsvImportWizard
      onDone={() => {
        invalidate();
        onDone?.();
      }}
    />
  );
}

export function AccountControlConnected({ onDone }) {
  return <AccountControl onDone={onDone} />;
}

export function MoneyRescueConnected({ onOpen }) {
  const { twin } = useBankData();
  return <MoneyRescuePanel cases={twin?.rescueCases ?? []} onOpen={onOpen} />;
}

export function RealityDriftConnected({ onOpen }) {
  const { twin } = useBankData();
  return <RealityDriftPanel drift={twin?.realityDrift ?? null} onOpen={onOpen} />;
}
