"use client";

// Financial Twin — the real, DB-only composition of the customer's money.
// Net worth, then where the money sits by liquidity (cash you can use /
// protected buffer / locked / invested), then every holding and debt with
// its own source, "updated" time and confidence. Nothing is invented: a
// missing figure stays missing.

import css from "../../showcase/fb.module.css";
import { FeatureHistory } from "./FeatureHistory.jsx";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { useTx } from "./i18n.jsx";
import { money, relTime } from "./format.js";

const SOURCE_LABEL = {
  ledger_derived: "From your transactions",
  bank_synced: "Bank-synced",
  government_linked: "Government-linked",
  insurer_linked: "Insurer-linked",
  user_confirmed: "You entered this",
  system_estimated: "Estimated",
  system_estimate: "Estimated",
  synthetic_fixture: "Sample data",
};
const LIQUIDITY_LABEL = {
  liquid: "Cash",
  restricted: "Locked",
  illiquid: "Locked",
  invested: "Invested",
};

export function FinancialTwinView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function Inner({ onBack, onAdd }) {
  const { tx } = useTx();
  const { twin, status } = useFutureBankData();

  if ((status === "loading" || status === "idle") && !twin) {
    return <Shell onBack={onBack}><p className={css.lede}>{tx("Building your money picture…")}</p></Shell>;
  }
  const t = twin?.twin ?? {};
  const h = twin?.holdings ?? { cashAccounts: [], assets: [], liabilities: [], incomeStreams: [] };
  const empty = !twin || twin.isEmpty;
  const bb = t.balanceBreakdown ?? {};

  const pools = [
    { key: "cash", label: tx("Cash you can use"), value: bb.availableNow, why: tx("Liquid, not protected, not already spoken for.") },
    { key: "protected", label: tx("Protected buffer"), value: bb.protectedFor, why: tx("Set aside as your safety reserve.") },
    { key: "locked", label: tx("Locked"), value: t.restrictedAssets, why: tx("CPF, property and other money that needs a separate decision to use.") },
    { key: "invested", label: tx("Invested"), value: t.investedAssets, why: tx("In the market — value moves, not spendable today.") },
  ];

  const allHoldings = [
    ...h.cashAccounts.map((x) => ({ ...x, kind: "asset" })),
    ...h.assets.map((x) => ({ ...x, kind: "asset" })),
  ];
  const sourceCount = t.provenance?.sourceCounts ?? {};
  const estimated = (sourceCount.system_estimated ?? 0) + (sourceCount.system_estimate ?? 0);
  const synthetic = sourceCount.synthetic_fixture ?? 0;

  return (
    <Shell onBack={onBack}>
      <h1 className={css.title}>{tx("Your money picture")}</h1>

      {empty ? (
        <div className={css.section}>
          <p className={css.lede}>{tx("Nothing added yet. Your Financial Twin is built only from real accounts, assets, debts and income you add — never assumed.")}</p>
          <button type="button" className={css.cta} onClick={onAdd}>{tx("Add an account or asset")}</button>
        </div>
      ) : (
        <>
          <div className={css.bigAmountWrap}>
            <span className={css.bigAmountLabel}>{tx("Net worth")}</span>
            <span className={css.bigAmount}>{money(t.netWorth)}</span>
          </div>
          <p className={css.micro}>{tx("Assets")} {money(t.financialAssetsTotal)} − {tx("debts")} {money(t.liabilitiesTotal)}. {tx("Life Capital (skills, relationships) is described in Life, never counted here.")}</p>

          <section className={css.section}>
            <p className={css.kicker}>{tx("Where your money sits")}</p>
            {pools.map((p) => (
              <div key={p.key} className={css.stateChip} style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <span>
                  <b style={{ fontSize: 14 }}>{p.label}</b>
                  <br />
                  <span className={css.micro}>{p.why}</span>
                </span>
                <b style={{ fontSize: 15, whiteSpace: "nowrap" }}>{money(p.value)}</b>
              </div>
            ))}
          </section>

          <section className={css.section}>
            <p className={css.kicker}>{tx("Holdings")}</p>
            {allHoldings.length === 0 ? (
              <p className={css.micro}>{tx("No accounts or assets added.")}</p>
            ) : (
              <div className={css.activity}>
                {allHoldings.map((row, i) => (
                  <div key={i} className={css.actItem}>
                    <span className={css.actBody}>
                      <span className={css.actName}>{row.label}</span>
                      <span className={css.actMeta}>
                        {tx(LIQUIDITY_LABEL[row.liquidity] ?? row.class)} · {tx(SOURCE_LABEL[row.sourceType] ?? row.sourceType)}
                        {row.asOf ? ` · ${tx("updated")} ${relTime(row.asOf)}` : ""}
                        {row.confidence && row.confidence !== "high" ? ` · ${tx(row.confidence)} ${tx("confidence")}` : ""}
                      </span>
                    </span>
                    <span className={css.actAmt}>{money(row.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {h.liabilities.length > 0 && (
            <section className={css.section}>
              <p className={css.kicker}>{tx("Debts")}</p>
              <div className={css.activity}>
                {h.liabilities.map((row, i) => (
                  <div key={i} className={css.actItem}>
                    <span className={css.actBody}>
                      <span className={css.actName}>{row.label}</span>
                      <span className={css.actMeta}>
                        {tx(SOURCE_LABEL[row.sourceType] ?? row.sourceType)}
                        {row.asOf ? ` · ${tx("updated")} ${relTime(row.asOf)}` : ""}
                        {row.minimumMonthly ? ` · ${tx("min")} ${money(row.minimumMonthly)}/mo` : ""}
                      </span>
                    </span>
                    <span className={`${css.actAmt} ${css.out}`}>− {money(row.value)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {h.incomeStreams.length > 0 && (
            <section className={css.section}>
              <p className={css.kicker}>{tx("Income")}</p>
              <div className={css.activity}>
                {h.incomeStreams.map((row, i) => (
                  <div key={i} className={css.actItem}>
                    <span className={css.actBody}>
                      <span className={css.actName}>{row.label}</span>
                      <span className={css.actMeta}>
                        {tx(SOURCE_LABEL[row.sourceType] ?? row.sourceType)}
                        {row.nextExpectedDate ? ` · ${tx("next")} ${relTime(row.nextExpectedDate)}` : ""}
                      </span>
                    </span>
                    <span className={`${css.actAmt} ${css.in}`}>{money(row.monthlyAmount)}/mo</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={css.section}>
            <p className={css.kicker}>{tx("Data quality")}</p>
            <p className={css.micro}>
              {allHoldings.length + h.liabilities.length} {tx("holdings")} ·{" "}
              {(sourceCount.bank_synced ?? 0) + (sourceCount.government_linked ?? 0) + (sourceCount.insurer_linked ?? 0)} {tx("linked")} ·{" "}
              {sourceCount.user_confirmed ?? 0} {tx("you confirmed")}
              {estimated ? ` · ${estimated} ${tx("estimated")}` : ""}
            </p>
            {synthetic > 0 ? <p className={css.err}>{synthetic} {tx("row(s) are sample data — replace them with your real figures.")}</p> : null}
            <button type="button" className={css.link} onClick={onAdd}>{tx("Add or update a holding →")}</button>
          </section>
        </>
      )}
      <FeatureHistory feature="twin" label="Changes to your money picture" />
    </Shell>
  );
}

function Shell({ children, onBack }) {
  const { tx } = useTx();
  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        {onBack ? <button type="button" className={css.backLink} onClick={onBack}>← {tx("Today")}</button> : null}
        {children}
      </div>
    </div>
  );
}
