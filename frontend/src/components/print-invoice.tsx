import { Banknote, CreditCard, FileText, Home, Info, Landmark, Mail, MapPin, Phone, Smartphone, User, Wallet, type LucideIcon } from "lucide-react";
import { BuildingIllustration } from "@/components/building-illustration";
import { LogoMark } from "@/components/logo";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import type { Invoice, PaymentMethod, Settings } from "@/lib/types";
import { formatDate, METHOD_LABEL, periodLabel, taka } from "@/lib/utils";

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  BANK: Landmark,
  BKASH: Smartphone,
  NAGAD: Smartphone,
  ROCKET: Smartphone,
  CHEQUE: FileText,
  OTHER: Wallet,
};

/**
 * A4 print layout for an invoice. Hidden on screen; the on-screen card is hidden when printing.
 * Renders a zero-margin @page rule (only while this component is on screen) so the header art and
 * bottom wave reach the paper edge. A named page would force blank pages before and after.
 */
export function PrintInvoice({ inv, settings }: { inv: Invoice; settings: Settings }) {
  const methods = settings.paymentMethods ?? [];
  return (
    <article className="relative hidden h-[296mm] flex-col overflow-hidden bg-white text-ink print:flex">
      <style>{"@media print { @page { size: A4; margin: 0; } }"}</style>
      {/* Header */}
      <header className="relative flex items-center gap-8 border-b border-line px-[14mm] pt-[12mm] pb-[8mm]">
        <BuildingIllustration className="absolute top-0 right-0 h-full w-[58%] opacity-25" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-[64px] w-[72px]" />
          <div className="leading-tight">
            <p className="text-[40px] leading-none font-extrabold tracking-tight text-primary">STMS</p>
            <p className="mt-1 text-[12px] font-medium text-ink">
              Shantikunjo Tenant
              <br />
              Management System
            </p>
          </div>
        </div>
        <div className="relative h-[80px] w-px bg-line" />
        <div className="relative">
          <p className="text-[44px] leading-none font-extrabold tracking-tight text-primary">Invoice</p>
          <p className="mt-2 text-[15px] text-muted">Tenant Service &amp; Billing</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-[14mm] pt-[9mm]">
        {inv.status === "VOID" && (
          <p className="mb-5 rounded-lg border border-danger bg-danger-bg px-4 py-2 text-[13px] font-semibold text-danger">
            This invoice is void{inv.voidReason ? `: ${inv.voidReason}` : ""}.
          </p>
        )}

        {/* Tenant + invoice details */}
        <section className="grid grid-cols-2">
          <div className="border-r border-line pr-8">
            <SectionTitle icon={User}>Tenant Information</SectionTitle>
            <p className="mt-3 text-[22px] font-extrabold text-primary">{inv.tenant.fullName}</p>
            <ul className="mt-3 flex flex-col gap-2 text-[14px]">
              <IconRow icon={Home}>Apartment {inv.apartment.number}</IconRow>
              <IconRow icon={Phone}>{inv.tenant.phone}</IconRow>
              {inv.tenant.email && <IconRow icon={Mail}>{inv.tenant.email}</IconRow>}
            </ul>
          </div>
          <div className="pl-10">
            <SectionTitle icon={FileText}>Invoice Details</SectionTitle>
            <dl className="mt-4 grid grid-cols-[120px_1fr] items-center gap-y-3 text-[14px]">
              <dt className="text-ink/80">Invoice No:</dt>
              <dd className="font-extrabold text-primary">{inv.number}</dd>
              <dt className="text-ink/80">Billing Month:</dt>
              <dd>{periodLabel(inv.period, true)}</dd>
              <dt className="text-ink/80">Issue Date:</dt>
              <dd>{formatDate(inv.issueDate)}</dd>
              <dt className="text-ink/80">Due Date:</dt>
              <dd>{formatDate(inv.dueDate)}</dd>
              <dt className="text-ink/80">Status:</dt>
              <dd>
                <InvoiceStatusBadge status={inv.displayStatus} />
              </dd>
            </dl>
          </div>
        </section>

        {/* Lines */}
        <table className="mt-8 w-full overflow-hidden rounded-xl text-[14px] [border-collapse:separate] [border-spacing:0] outline outline-1 outline-line">
          <thead className="bg-primary text-left text-white">
            <tr>
              <th className="px-5 py-3 font-bold">Description</th>
              <th className="w-[30%] border-l border-white/20 px-5 py-3 text-right font-bold">Amount (৳)</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={l.id} className={i % 2 ? "bg-primary-light/50" : "bg-white"}>
                <td className="border-t border-line px-5 py-2.5">{l.description}</td>
                <td className="tabular border-t border-l border-line px-5 py-2.5 text-right">{taka(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Notes + totals */}
        <section className="mt-6 grid grid-cols-2 items-center gap-8">
          <div>
            {settings.invoiceNote && (
              <>
                <SectionTitle icon={Info}>Notes</SectionTitle>
                <p className="mt-2 text-[13px] leading-relaxed text-ink/80">{settings.invoiceNote}</p>
              </>
            )}
          </div>
          <div className="overflow-hidden rounded-xl bg-primary-light">
            <div className="flex flex-col gap-2 px-5 py-4 text-[15px]">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="tabular font-extrabold text-primary">{taka(inv.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid Amount</span>
                <span className="tabular font-bold text-success">{taka(inv.paidAmount)}</span>
              </div>
            </div>
            <div className="flex justify-between bg-primary px-5 py-3.5 text-[18px] font-extrabold text-white">
              <span>Balance Due</span>
              <span className="tabular">{taka(inv.balance)}</span>
            </div>
          </div>
        </section>

        {/* Payments received */}
        {inv.payments.length > 0 && (
          <section className="mt-6">
            <SectionTitle icon={CreditCard}>Payments Received</SectionTitle>
            <ul className="mt-2 flex flex-col gap-1 text-[13px]">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 border-b border-line py-1">
                  <span>
                    {formatDate(p.date)} · {METHOD_LABEL[p.method]}
                    {p.reference ? ` · ${p.reference}` : ""} <span className="text-muted">({p.number})</span>
                  </span>
                  <span className="tabular font-semibold">{taka(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Payment instructions */}
        {methods.length > 0 && (
          <section className="mt-6 border-t border-line pt-5">
            <SectionTitle icon={CreditCard}>Payment Instructions</SectionTitle>
            <p className="mt-1 text-[13px]">You can pay via:</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {methods.map((m) => {
                const Icon = METHOD_ICON[m] ?? Wallet;
                return (
                  <li key={m} className="flex items-center gap-2.5 rounded-lg bg-primary-light/70 px-4 py-2.5 text-[13px] font-medium">
                    <Icon className="size-5 text-primary" aria-hidden />
                    {METHOD_LABEL[m]}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-auto flex items-end justify-between gap-6 border-t border-line pt-5 pb-[26mm]">
          <div>
            <p className="text-[15px] font-bold text-primary">Thank you for being a valued tenant!</p>
            <p className="mt-1 text-[12px] text-muted">For any queries, please contact the management office.</p>
            {(settings.contactPhone || settings.contactEmail) && (
              <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
                {settings.contactPhone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-primary" aria-hidden /> {settings.contactPhone}
                  </span>
                )}
                {settings.contactEmail && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-primary" aria-hidden /> {settings.contactEmail}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold text-primary">{settings.propertyName}</p>
            {settings.propertyAddress && (
              <p className="mt-1 flex items-center justify-end gap-1.5 text-[12px]">
                <MapPin className="size-3.5 text-primary" aria-hidden /> {settings.propertyAddress}
              </p>
            )}
          </div>
        </footer>
      </div>

      {/* Bottom wave */}
      <svg viewBox="0 0 800 70" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[18mm] w-full" aria-hidden>
        <path d="M0 40 C 220 70, 520 60, 800 8 L800 70 L0 70 Z" fill="#0B2D6B" />
        <path d="M430 52 C 600 40, 720 22, 800 0 L800 8 C 700 36, 580 50, 430 52 Z" fill="#2563EB" />
      </svg>
    </article>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[16px] font-bold text-primary">
      <Icon className="size-5" aria-hidden />
      {children}
    </h2>
  );
}

function IconRow({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <Icon className="size-4.5 text-primary" aria-hidden />
      {children}
    </li>
  );
}
