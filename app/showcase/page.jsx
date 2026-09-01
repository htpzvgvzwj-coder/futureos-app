import { FutureBankSlice } from "./FutureBankSlice.jsx";

export const dynamic = "force-dynamic";

// /showcase - the Future Bank vertical slice. A clean, deployable route
// with NONE of the legacy simulator / planner navigation.
export default function ShowcasePage() {
  return <FutureBankSlice />;
}
