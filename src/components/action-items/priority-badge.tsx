import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const priorityStyles = [
  "border-primary/70 bg-primary/30 text-primary shadow-sm shadow-primary/30",
  "border-primary/50 bg-primary/20 text-primary/90",
  "border-primary/35 bg-primary/10 text-primary/80",
  "border-primary/25 bg-primary/5 text-primary/70",
  "border-border bg-muted/40 text-muted-foreground",
] as const;

export function PriorityBadge({ priority }: { priority: number }) {
  const tier = Math.min(Math.max(priority, 1), priorityStyles.length) - 1;
  return (
    <Badge className={cn("tabular-nums", priorityStyles[tier])}>
      P{priority}
    </Badge>
  );
}
