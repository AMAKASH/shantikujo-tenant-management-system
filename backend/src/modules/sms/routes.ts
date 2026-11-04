import { Router } from "express";
import { isProd } from "../../config.js";
import { DEV_SMS_NUMBER, getBalance, smsConfigured } from "../../lib/sms.js";

export const smsRouter = Router();

/** Is SMS set up, is the dev override active, and how much credit is left. */
smsRouter.get("/status", async (_req, res) => {
  const configured = smsConfigured();
  res.json({
    configured,
    devOverride: !isProd,
    devNumber: isProd ? null : DEV_SMS_NUMBER,
    balance: configured ? await getBalance() : null,
  });
});
