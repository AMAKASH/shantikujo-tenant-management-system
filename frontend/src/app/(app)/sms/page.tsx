import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { SmsComposer } from "@/components/forms/sms-composer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { api } from "@/lib/api.server";
import type { SmsMessage, TenantListItem } from "@/lib/types";
import { dhakaDay, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "SMS" };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

function Recipient({ m }: { m: SmsMessage }) {
  return m.tenant ? (
    <Link href={`/tenants/${m.tenant.id}`} className="font-semibold hover:text-accent">
      {m.tenant.fullName}
    </Link>
  ) : (
    <span className="font-semibold">{m.phone}</span>
  );
}

function StatusBadge({ m }: { m: SmsMessage }) {
  return m.status === "SENT" ? (
    <Badge tone="success">Sent</Badge>
  ) : (
    <span title={m.error ?? undefined}>
      <Badge tone="danger">Failed</Badge>
    </span>
  );
}

const kindLabel = (m: SmsMessage) => (m.kind === "PAYMENT" ? `Payment ${m.payment?.number ?? ""}`.trim() : "Message");

export default async function SmsPage() {
  const [{ items: tenants }, { items: history }] = await Promise.all([
    api<{ items: TenantListItem[] }>("/tenants?status=active"),
    api<{ items: SmsMessage[] }>("/sms/history?limit=50"),
  ]);

  return (
    <>
      <PageHeader title="SMS" description="Send a message to tenants or any mobile number. Bill reminders are sent from Billing." />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SmsComposer tenants={tenants} />
        </div>
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader title="Recent messages" description="Messages and payment confirmations, newest first" />
          {history.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No messages yet" />
          ) : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {history.map((m) => (
                <li key={m.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm">
                      <Recipient m={m} />
                      <p className="text-xs text-muted">
                        {formatDate(dhakaDay(m.createdAt))} · {time(m.createdAt)} · {kindLabel(m)}
                        {m.tenant && ` · ${m.phone}`}
                      </p>
                    </div>
                    <StatusBadge m={m} />
                  </div>
                  <p lang="bn" className="mt-1.5 line-clamp-2 text-sm whitespace-pre-line text-ink/80" title={m.message}>
                    {m.message}
                  </p>
                  {m.status === "FAILED" && m.error && <p className="mt-1 text-xs font-medium text-danger">{m.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
