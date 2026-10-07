export {
  getEntitlementState,
  requireCapability,
  hasCapability,
  grantCompleteEntitlement,
  revokeCompleteEntitlement,
  entitlementSnapshot,
  assertWithinLimit,
  EntitlementError,
} from "@/services/entitlement-service";
export type { EntitlementState } from "@/services/entitlement-service";
