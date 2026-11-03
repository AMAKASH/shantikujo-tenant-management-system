import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./prisma.js";

export async function audit(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  diff?: Prisma.InputJsonValue,
  tx: Tx | typeof prisma = prisma,
) {
  await tx.auditLog.create({ data: { userId, action, entity, entityId, diff } });
}
