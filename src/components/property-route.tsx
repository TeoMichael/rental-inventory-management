"use client";

import { useSearchParams } from "next/navigation";
import PropertyDetail from "./property-detail";

export default function PropertyRoute() {
  const parameters = useSearchParams();
  const id = parameters.get("id") ?? "";
  // Firestore ownership checks remain in the existing workspace/repository.
  return <PropertyDetail id={/^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : ""} />;
}
