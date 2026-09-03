"use client";

// The three conventional bank actions - PayNow, Foreign Exchange, Scan &
// Pay - shown directly under the Available amount. These are NOT Future
// Bank intelligence; they are the visible banking functions a customer
// expects. Every one states its real capability honestly: nothing here
// fakes a payment, a quote or a scan.
//
// PayNow opens a real INTERNAL transfer between the customer's own
// accounts (a genuine ledger entry). External PayNow, executable FX and
// camera Scan & Pay need rails this preview does not have, so they open a
// sheet that says so plainly - before any money would move.

import css from "./future-bank.module.css";
import { useTx } from "./i18n.jsx";

export function BankNowActions({ onPayNow, onFx, onScanPay }) {
  const { tx } = useTx();
  return (
    <div className={css.bankActions} role="group" aria-label={tx("Bank actions")}>
      <button type="button" className={css.bankAction} onClick={onPayNow}>
        <span className={css.bankGlyph}>⇄</span>
        <span className={css.bankLabel}>{tx("PayNow")}</span>
        <span className={css.bankState}>{tx("Move your money")}</span>
      </button>
      <button type="button" className={css.bankAction} onClick={onFx}>
        <span className={css.bankGlyph}>$€</span>
        <span className={css.bankLabel}>{tx("Foreign Exchange")}</span>
        <span className={css.bankState}>{tx("Indicative only")}</span>
      </button>
      <button type="button" className={css.bankAction} onClick={onScanPay}>
        <span className={css.bankGlyph}>▣</span>
        <span className={css.bankLabel}>{tx("Scan & Pay")}</span>
        <span className={css.bankState}>{tx("Not connected")}</span>
      </button>
    </div>
  );
}
