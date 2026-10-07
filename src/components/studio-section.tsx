import Link from "next/link";
import { Card, CardHeader, Alert } from "@/components/ui/primitives";
import {
  StudioPanel,
  type StudioDescriptorView,
} from "@/components/studio-panel";

/**
 * One studio workflow as a collapsible card.
 *
 * The descriptor is resolved on the server, so this component renders whatever
 * the registry declared without knowing which workflow it is.
 */
export function StudioSection({
  workflow,
  descriptor,
  can,
}: {
  workflow: { id: string; title: string; description: string };
  descriptor: StudioDescriptorView | null;
  can: boolean;
}) {
  if (!can || !descriptor) {
    return (
      <Card>
        <CardHeader
          title={workflow.title}
          description={workflow.description}
          action={
            <Link href="/app/settings" className="btn-secondary">
              Upgrade
            </Link>
          }
        />
        <Alert tone="info">Complete Edition feature.</Alert>
      </Card>
    );
  }

  return (
    <details className="card-muted p-4">
      <summary className="cursor-pointer">
        <span className="text-sm font-semibold text-[var(--text)]">
          {workflow.title}
        </span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {workflow.description}
        </p>
      </summary>
      <div className="mt-4">
        <StudioPanel descriptor={descriptor} />
      </div>
    </details>
  );
}
