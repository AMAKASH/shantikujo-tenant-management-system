import { prisma } from "../../lib/prisma.js";
import { getSettings } from "../../lib/settings.js";

/** v1 is single-property: return the first property, creating it on demand. */
export async function getDefaultProperty() {
  const existing = await prisma.property.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  const s = await getSettings();
  return prisma.property.create({ data: { name: s.propertyName, address: s.propertyAddress || null } });
}
