import { ButtonLink } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <LogoMark className="mx-auto mb-6 h-14 w-16" />
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="mt-1 text-2xl font-extrabold text-primary">Page not found</h1>
        <p className="mt-2 text-muted">The page you are looking for doesn&apos;t exist or was removed.</p>
        <ButtonLink href="/dashboard" className="mt-6" arrow>
          Back to dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
