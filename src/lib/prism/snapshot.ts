import { z } from "zod";
import type { ProjectDashboard } from "@/lib/action-items/service";

export const prismMetricProposalSchema = z.object({
  kpiId: z.string().uuid(),
  value: z.number().finite(),
  source: z.string().min(1).max(100),
  sourceUrl: z.string().url().nullable(),
  evidence: z.string().min(1).max(2_000),
  confidence: z.enum(["low", "medium", "high"])
}).strict();

export const prismSnapshotProposalSchema = z.object({
  capturedAt: z.string().datetime(),
  metrics: z.array(prismMetricProposalSchema),
  unavailable: z.array(z.object({
    kpiId: z.string().uuid(),
    reason: z.string().min(1).max(2_000)
  }).strict())
}).strict();

export type PrismSnapshotProposal = z.infer<typeof prismSnapshotProposalSchema>;

export function buildSnapshotHookInput(dashboard: ProjectDashboard) {
  const kpis = dashboard.kpis.map((kpi) => ({
    kpiId: kpi.id,
    name: kpi.name,
    description: kpi.description,
    unit: kpi.unit,
    configuredSource: kpi.source,
    sourceUrl: kpi.sourceUrl,
    baselineValue: kpi.baselineValue,
    targetValue: kpi.targetValue,
    currentValue: kpi.currentValue,
    measurementConfig: kpi.measurementConfig
  }));
  return {
    projectTitle: dashboard.project.title,
    projectKpisData: {
      project: { id: dashboard.project.id, title: dashboard.project.title, intent: dashboard.project.intent },
      kpis
    }
  };
}

export function parseSnapshotProposal(content: string, expectedKpiIds: string[]) {
  let value: unknown;
  try {
    value = JSON.parse(content.trim());
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (!fenced) return { proposal: null, error: "Prism did not return valid JSON." } as const;
    try { value = JSON.parse(fenced.trim()); }
    catch { return { proposal: null, error: "Prism did not return valid JSON." } as const; }
  }
  const parsed = prismSnapshotProposalSchema.safeParse(value);
  if (!parsed.success) return { proposal: null, error: "Prism returned JSON that did not match the snapshot schema." } as const;

  const returnedIds = [...parsed.data.metrics.map((metric) => metric.kpiId), ...parsed.data.unavailable.map((entry) => entry.kpiId)];
  const expected = [...expectedKpiIds].sort();
  const returned = [...returnedIds].sort();
  if (new Set(returnedIds).size !== returnedIds.length || expected.length !== returned.length || expected.some((id, index) => id !== returned[index])) {
    return { proposal: null, error: "Prism did not account for every configured KPI exactly once." } as const;
  }
  return { proposal: parsed.data, error: null } as const;
}
