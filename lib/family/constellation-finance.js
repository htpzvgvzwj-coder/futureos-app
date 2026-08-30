// Family Living Plan - Family Constellation + Blind Merge (pure, no DB/AI).
//
// A shared future with boundaries. Two partners each set a private
// affordable range and a set of Must Keep / Flexible / Undecided items;
// only THEN is a jointly-feasible band computed. Individual balances stay
// private - only the agreed shared monthly contribution is visible.

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// party: { affordableMin, affordableMax, mustKeep: [ids], flexible: [ids],
//          undecided: [ids] }
// Returns the overlap band + conflict points. Never reveals either party's
// raw numbers beyond the band.
export function blindMerge({ partnerA, partnerB, sharedItems = [] }) {
  const aMin = num(partnerA?.affordableMin);
  const aMax = num(partnerA?.affordableMax, aMin);
  const bMin = num(partnerB?.affordableMin);
  const bMax = num(partnerB?.affordableMax, bMin);

  const bandLow = Math.max(aMin, bMin);
  const bandHigh = Math.min(aMax, bMax);
  const feasibleBandExists = bandHigh >= bandLow;

  const setA = new Set([...(partnerA?.mustKeep ?? [])]);
  const setB = new Set([...(partnerB?.mustKeep ?? [])]);
  const flexA = new Set([...(partnerA?.flexible ?? [])]);
  const flexB = new Set([...(partnerB?.flexible ?? [])]);

  const conflicts = [];
  for (const item of sharedItems) {
    const aWants = setA.has(item.id);
    const bWants = setB.has(item.id);
    const aFlex = flexA.has(item.id);
    const bFlex = flexB.has(item.id);
    if (aWants && bFlex) conflicts.push({ itemId: item.id, kind: "one_must_one_flexible", mustKeepSide: "A" });
    else if (bWants && aFlex) conflicts.push({ itemId: item.id, kind: "one_must_one_flexible", mustKeepSide: "B" });
    else if ((partnerA?.undecided ?? []).includes(item.id) || (partnerB?.undecided ?? []).includes(item.id)) {
      conflicts.push({ itemId: item.id, kind: "undecided" });
    }
  }

  const agreedMustKeep = sharedItems.filter((i) => setA.has(i.id) && setB.has(i.id)).map((i) => i.id);
  const agreedMustKeepCost = sharedItems
    .filter((i) => agreedMustKeep.includes(i.id))
    .reduce((s, i) => s + num(i.monthlyCost), 0);

  return {
    feasibleBandExists,
    // Only the band is shared - not either side's min/max.
    jointBand: feasibleBandExists ? { low: Math.round(bandLow), high: Math.round(bandHigh) } : null,
    agreedMustKeep,
    agreedMustKeepMonthlyCost: Math.round(agreedMustKeepCost),
    conflicts,
    bothConfirmedRequired: conflicts.length > 0 || !feasibleBandExists,
  };
}

// The constellation's monthly shape. planData: {
//   shared_monthly_contribution, partner_share_ratio (0..1, A's share),
//   items: [{ id, category, monthlyCost, timelineStartMonth? }],
//   partnerA_private: {...}, partnerB_private: {...}  // NEVER returned
// }
export function computeFamilyConstellation({ planData }) {
  const shared = num(planData.shared_monthly_contribution);
  const ratio = Math.max(0, Math.min(1, num(planData.partner_share_ratio, 0.5)));
  const items = Array.isArray(planData.items) ? planData.items : [];
  const committedMonthly = items.reduce((s, i) => s + num(i.monthlyCost), 0);

  const merge =
    planData.partnerA_view || planData.partnerB_view
      ? blindMerge({ partnerA: planData.partnerA_view, partnerB: planData.partnerB_view, sharedItems: items })
      : null;

  return {
    available: true,
    sharedMonthlyContribution: Math.round(shared),
    partnerAShare: Math.round(shared * ratio),
    partnerBShare: Math.round(shared * (1 - ratio)),
    committedMonthly: Math.round(committedMonthly),
    surplusMonthly: Math.round(shared - committedMonthly),
    onPace: shared >= committedMonthly,
    itemsByCategory: items.reduce((acc, i) => {
      (acc[i.category] = acc[i.category] ?? []).push({ id: i.id, monthlyCost: num(i.monthlyCost) });
      return acc;
    }, {}),
    blindMerge: merge,
    // Any change to the shared contribution / ratio / a Must-Keep item
    // needs both partners.
    bothConfirmedRequired: Boolean(merge?.bothConfirmedRequired),
    privacyNote: "individual_balances_never_shared",
    sources: ["agreed shared contribution", "shared item costs"],
    assumptions: ["Each partner's private affordability and balances are never shared - only the agreed band and shared contribution."],
    sealable: !merge || merge.feasibleBandExists,
  };
}
