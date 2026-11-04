-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "InvoiceNotification" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "phone" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "providerCode" TEXT,
    "error" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceNotification_invoiceId_status_idx" ON "InvoiceNotification"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "InvoiceNotification_tenantId_idx" ON "InvoiceNotification"("tenantId");

-- AddForeignKey
ALTER TABLE "InvoiceNotification" ADD CONSTRAINT "InvoiceNotification_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceNotification" ADD CONSTRAINT "InvoiceNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceNotification" ADD CONSTRAINT "InvoiceNotification_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
