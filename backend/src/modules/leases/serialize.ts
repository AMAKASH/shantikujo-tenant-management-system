import type { Lease } from "@prisma/client";
import { isoDate } from "../../lib/dates.js";
import { num } from "../../lib/money.js";

const d = (v: Date | null) => (v ? isoDate(v) : null);

export function serializeLease<T extends Lease>(l: T) {
  return {
    ...l,
    rent: num(l.rent)!,
    serviceCharge: num(l.serviceCharge)!,
    securityDeposit: num(l.securityDeposit)!,
    startDate: isoDate(l.startDate),
    endDate: d(l.endDate),
    depositReceivedAt: d(l.depositReceivedAt),
    noticeGivenAt: d(l.noticeGivenAt),
    moveOutDate: d(l.moveOutDate),
    endedAt: d(l.endedAt),
  };
}
