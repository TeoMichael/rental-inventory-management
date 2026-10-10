import { Suspense } from "react";
import PropertyRoute from "@/components/property-route";

// Property data already loads in the authenticated browser workspace. A static
// shell avoids rendering it again on a Worker with a 10 ms CPU allowance.
export default function PropertyPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading property…</p>}>
      <PropertyRoute />
    </Suspense>
  );
}
