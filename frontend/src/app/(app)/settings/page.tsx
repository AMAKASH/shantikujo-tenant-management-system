import type { Metadata } from "next";
import { ChangePasswordForm, SettingsForm } from "@/components/forms/settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { api } from "@/lib/api.server";
import type { Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

interface AuditItem {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  user: { name: string } | null;
}

export default async function SettingsPage() {
  const [settings, audit] = await Promise.all([api<Settings>("/settings"), api<{ items: AuditItem[] }>("/settings/audit-log")]);
  return (
    <>
      <PageHeader title="Settings" description="Property, billing rules and your account" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SettingsForm settings={settings} />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Change password" />
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="File storage" />
            <CardBody className="text-sm">
              {settings.storage === "s3" ? (
                <p>
                  <Badge tone="success">Amazon S3</Badge> Documents are stored in a private bucket and opened through short-lived links.
                </p>
              ) : (
                <p>
                  <Badge tone="warning">Local disk</Badge> Set the S3 variables to store documents in S3.
                </p>
              )}
            </CardBody>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Recent activity" description="Audit log" />
            <ul className="mt-2 max-h-96 divide-y divide-line overflow-y-auto text-sm">
              {audit.items.slice(0, 50).map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <p>
                    <span className="font-semibold capitalize">{a.action.replace("-", " ")}</span> {a.entity.toLowerCase()}
                  </p>
                  <p className="text-xs text-muted">
                    {a.user?.name ?? "System"} · {new Date(a.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
