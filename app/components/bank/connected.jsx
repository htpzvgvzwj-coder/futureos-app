"use client";

// Connectors so app/page.jsx can drop the bank surfaces into its screen map
// without threading data - they read useBankData() themselves (they render
// inside <BankDataProvider>).

import { useBankData } from "./useBankData.jsx";
import { BankTodayHeader } from "./BankTodayHeader.jsx";
import { GuardianSections } from "./GuardianSections.jsx";
import { CurrentRippleStrip } from "./CurrentRippleStrip.jsx";

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
