-- CreateEnum
CREATE TYPE "SmsKind" AS ENUM ('CUSTOM', 'PAYMENT');

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "kind" "SmsKind" NOT NULL,
    "batchId" TEXT,
    "tenantId" TEXT,
    "paymentId" TEXT,
    "phone" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "providerCode" TEXT,
    "error" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsMessage_tenantId_idx" ON "SmsMessage"("tenantId");

-- CreateIndex
CREATE INDEX "SmsMessage_paymentId_status_idx" ON "SmsMessage"("paymentId", "status");

-- CreateIndex
CREATE INDEX "SmsMessage_createdAt_idx" ON "SmsMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
