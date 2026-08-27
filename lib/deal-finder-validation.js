import { z } from "zod";

// Options are independent alternatives, not summed line items - there is
// no single "total" to recompute server-side here the way wedding/travel
// do. Validation instead enforces that every option carries a real
// source and a real positive price, so nothing unexplained gets through.

const dealOption = z.object({
  name: z.string().min(1),
  vendor: z.string().min(1),
  price: z.number().min(0),
  currency: z.string().min(1),
  unit: z.string().min(1),
  source: z.string().min(1),
  notes: z.string(),
});

export const proposeDealOptionsSchema = z.object({
  query_summary: z.string().min(1),
  options: z.array(dealOption).min(2).max(4),
  research_notes: z.string(),
});
