export const metadata = {
  title: "Future Bank",
  description: "Your real money, what it means, your next decision.",
};

// A clean shell for the Future Bank vertical slice - NONE of the legacy
// simulator / planner navigation.
export default function ShowcaseLayout({ children }) {
  return <div className="fbSlice">{children}</div>;
}
