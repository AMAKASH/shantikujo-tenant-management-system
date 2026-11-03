import { BillingTabs } from "@/components/ui/billing-tabs";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="print:hidden">
        <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-primary sm:text-[28px]">Billing</h1>
        <BillingTabs />
      </div>
      {children}
    </>
  );
}
