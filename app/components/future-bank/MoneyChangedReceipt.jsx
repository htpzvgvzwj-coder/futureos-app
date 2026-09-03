"use client";

// Today section 5 - "What changed since you last opened". ONE persisted
// consequence assembled server-side from Ripple / Change Ledger / Life
// Thread (money-moments `moneyChanged`). Reads in plain language:
//
//   what happened -> money now -> which plan/buffer moved -> next action
//
// If there is no material change, it says so and shows the next known
// money event instead. Nothing is computed here.

import css from "./future-bank.module.css";
import { useFutureBankData } from "./FutureBankDataProvider.jsx";
import { useTx } from "./i18n.jsx";
import { money, shortDate } from "./format.js";

export function MoneyChangedReceipt({ onRoute, onHistory }) {
  const { tx } = useTx();
  const { moneyChanged } = useFutureBankData();
  if (!moneyChanged) return null;

  if (!moneyChanged.hasChange) {
    const ev = moneyChanged.nextEvent;
    return (
      <div className={css.calm}>
        <span className={css.calmTitle}>{tx("No material change since your last check.")}</span>
        {ev ? (
          <span className={css.empty}>
            {tx("Next")}: {tx(ev.label)} {money(ev.amount, { signed: true })}
            {ev.when ? ` ${tx("on")} ${shortDate(ev.when)}` : ""}.
          </span>
        ) : (
          <span className={css.empty}>{tx("No upcoming money event on record yet.")}</span>
        )}
      </div>
    );
  }

  const mc = moneyChanged;
  return (
    <div className={css.changed}>
      <div className={css.changedHeadline}>{mc.headline}</div>
      <div className={css.changedLine}>
        <span className={css.changedArrow}>→</span>
        <span>
          {mc.moneyNow?.label}: <b>{money(mc.moneyNow?.value)}</b>
        </span>
      </div>
      <div className={css.changedLine}>
        <span className={css.changedArrow}>→</span>
        <span>{mc.planEffect}</span>
      </div>
      <div className={css.changedLine}>
        <span className={css.changedArrow}>→</span>
        <span>{mc.safetyEffect}</span>
      </div>
      <div className={css.momentActions}>
        {mc.nextAction ? (
          <button
            type="button"
            className={`${css.act} ${css.primary}`}
            disabled={mc.nextAction.available === false}
            onClick={() => onRoute?.(mc.nextAction.route || "history")}
          >
            {tx(mc.nextAction.label)}
          </button>
        ) : null}
        <button type="button" className={css.act} onClick={onHistory}>
          {tx("View full history")}
        </button>
      </div>
    </div>
  );
}
