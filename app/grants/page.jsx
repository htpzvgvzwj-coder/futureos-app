"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This standalone route used to render its own raw permissions form. That
// experience is now the real Family CFO screen inside the app shell
// (app/page.jsx's FamilyCfoScreen) - a family member's shared access is no
// longer just a settings record, it's an actual real financial picture.
// Kept as a redirect rather than deleted, since a couple of existing links
// (a Home nudge card, a Profile shortcut) still point at /grants.
export default function GrantsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?screen=familyCfo");
  }, [router]);

  return null;
}
