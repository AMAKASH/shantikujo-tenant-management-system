import cron from "node-cron";
import { currentPeriod } from "../lib/dates.js";
import { logger } from "../lib/logger.js";
import { generateForPeriod } from "../modules/invoices/service.js";

/**
 * Monthly invoice generation at 00:05 on the 1st (Asia/Dhaka). Also runs once at startup so a missed
 * run (e.g. the container was down on the 1st) is caught up. Generation is idempotent.
 */
export function startScheduler() {
  const run = async () => {
    try {
      const r = await generateForPeriod(currentPeriod());
      if (r.created) logger.info(r, "Monthly invoices generated");
    } catch (err) {
      logger.error({ err }, "Invoice generation failed");
    }
  };
  cron.schedule("5 0 1 * *", run, { timezone: "Asia/Dhaka" });
  setTimeout(run, 5_000);
}
