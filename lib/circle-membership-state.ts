export type CircleMembershipStatus =
  | "active" | "approved" | "pending" | "banned" | "rejected" | "left"
  | string | null | undefined

export type CircleMembershipAction =
  | { kind: "enter" | "join" | "request-join" | "cancel-request" | "unavailable"; label: string }

export function resolveCircleMembershipAction(
  status: CircleMembershipStatus, isPrivate: boolean, isMember = false,
): CircleMembershipAction {
  if (status === "active" || status === "approved" || isMember) return { kind: "enter", label: "Enter Circle" }
  if (status === "pending") return { kind: "cancel-request", label: "Request pending · Cancel" }
  if (status === "banned") return { kind: "unavailable", label: "Unavailable" }
  return isPrivate
    ? { kind: "request-join", label: "Request to join" }
    : { kind: "join", label: "Join Circle" }
}

export function isPrivateCircleDiscoverable(input: {
  isPrivate: boolean; viewerId: string | null; ownerId?: string | null; membershipStatus?: CircleMembershipStatus
}): boolean {
  if (!input.isPrivate) return true
  if (!input.viewerId) return false
  if (input.viewerId === input.ownerId) return true
  return input.membershipStatus === "active"
    || input.membershipStatus === "approved"
    || input.membershipStatus === "pending"
}
