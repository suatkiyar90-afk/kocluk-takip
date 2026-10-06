export type PolicyDocumentKey = "kvkk_student" | "kvkk_teacher";

export type PolicyAcknowledgmentStatus = "exempt" | "ok" | "required";

export type PolicyStatusResult =
  | { status: "exempt" }
  | { status: "ok"; key: PolicyDocumentKey; version: string }
  | { status: "required"; key: PolicyDocumentKey; version: string };

export type PolicyAcknowledgeResult =
  | { success: true; message: string }
  | {
      success: false;
      status: "UNAUTHORIZED" | "FORBIDDEN" | "DATABASE_ERROR";
      message: string;
    };

export function documentKeyForRole(
  role: string | null | undefined,
): PolicyDocumentKey | null {
  if (role === "student") return "kvkk_student";
  if (role === "teacher") return "kvkk_teacher";
  return null;
}

export function needsPolicyAcknowledgment(input: {
  role: string | null | undefined;
  version: string;
  acknowledgedVersions: readonly string[];
}): boolean {
  if (documentKeyForRole(input.role) === null) {
    return false;
  }
  return !input.acknowledgedVersions.includes(input.version);
}

export async function checkPolicyFailOpen(args: {
  role: string | null | undefined;
  version: string;
  loadAcknowledgedVersions: () => Promise<readonly string[]>;
}): Promise<{ status: PolicyAcknowledgmentStatus }> {
  if (documentKeyForRole(args.role) === null) {
    return { status: "exempt" };
  }
  try {
    const acknowledgedVersions = await args.loadAcknowledgedVersions();
    const needs = needsPolicyAcknowledgment({
      role: args.role,
      version: args.version,
      acknowledgedVersions,
    });
    return { status: needs ? "required" : "ok" };
  } catch (err) {
    console.error("Politika durumu okunamadı:", err);
    return { status: "exempt" };
  }
}
