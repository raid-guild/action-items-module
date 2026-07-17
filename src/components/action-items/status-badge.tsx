import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/client-api";

const styles: Record<ActionItem["status"], string> = {
  open: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  active: "border-primary/30 bg-primary/10 text-primary",
  completed: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  cancelled: "border-secondary/30 bg-secondary/10 text-secondary"
};

export function StatusBadge({ status }: { status: ActionItem["status"] }) {
  return <Badge className={cn("capitalize", styles[status])}>{status}</Badge>;
}
