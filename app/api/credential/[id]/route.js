import { getCredential } from "../../../../lib/credential-store.js";

export const runtime = "nodejs";

// The "verify" endpoint - anyone the customer shares a credential id with (a landlord, a new
// employer) can hit this and see exactly what OCBC issued, independent of anything the customer
// showed them. Deliberately public (no auth) - the id itself is the capability, same as any
// shareable verification link.
export async function GET(_request, { params }) {
  const { id } = await params;
  const credential = await getCredential(id);
  if (!credential) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(credential);
}
