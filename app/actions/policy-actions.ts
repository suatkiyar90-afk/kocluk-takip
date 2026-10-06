"use server";

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { policyAcknowledgments } from "@/db/schema";
import { actionErrorMessage } from "@/lib/action-error";
import { documentForRole } from "@/lib/legal";
import {
  checkPolicyFailOpen,
  type PolicyAcknowledgeResult,
  type PolicyStatusResult,
} from "@/lib/policy";

const loadMyPolicyStatus = cache(
  async (): Promise<PolicyStatusResult> => {
    const session = await auth();
    const doc = documentForRole(session?.user?.role);
    if (!session?.user?.id || !doc) {
      return { status: "exempt" };
    }

    const userId = session.user.id;
    const outcome = await checkPolicyFailOpen({
      role: session.user.role,
      version: doc.version,
      loadAcknowledgedVersions: async () => {
        const rows = await db
          .select({ version: policyAcknowledgments.version })
          .from(policyAcknowledgments)
          .where(
            and(
              eq(policyAcknowledgments.userId, userId),
              eq(policyAcknowledgments.documentKey, doc.key),
            ),
          );
        return rows.map((row) => row.version);
      },
    });

    if (outcome.status === "exempt") {
      return { status: "exempt" };
    }
    if (outcome.status === "ok") {
      return { status: "ok", key: doc.key, version: doc.version };
    }
    return { status: "required", key: doc.key, version: doc.version };
  },
);

export async function getMyPolicyStatus(): Promise<PolicyStatusResult> {
  return loadMyPolicyStatus();
}

export async function acknowledgeMyPolicy(): Promise<PolicyAcknowledgeResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      status: "UNAUTHORIZED",
      message: "Bu işlem için oturum açmanız gerekiyor.",
    };
  }

  const doc = documentForRole(session.user.role);
  if (!doc) {
    return {
      success: false,
      status: "FORBIDDEN",
      message: "Bu işlem sizin hesabınız için gerekli değil.",
    };
  }

  try {
    await db
      .insert(policyAcknowledgments)
      .values({
        userId: session.user.id,
        documentKey: doc.key,
        version: doc.version,
      })
      .onConflictDoNothing();

    return { success: true, message: "Bilgilendirmeyi okuduğunuz kaydedildi." };
  } catch (err) {
    return {
      success: false,
      status: "DATABASE_ERROR",
      message: actionErrorMessage(err),
    };
  }
}
