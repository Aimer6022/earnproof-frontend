import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { TrustedSourceManagement } from "@/components/trusted-sources/trusted-source-management";
import { PublicShell } from "@/components/layout/public-shell";

export default function TrustedSourcesPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Configure and verify trusted sources before enabling them for income and payment verification."
          eyebrow="Administration"
          title="Trusted Sources"
        />
        <TrustedSourceManagement />
      </section>
    </PublicShell>
  );
}
