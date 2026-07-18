"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionItem, ProjectSummary } from "@/lib/client-api";

export type ActionItemFilters = {
  myItems: boolean;
  statuses: ActionItem["status"][];
  priorities: number[];
  projectIds: string[];
};

export const defaultActionItemFilters: ActionItemFilters = {
  myItems: false,
  statuses: ["open", "active"],
  priorities: [],
  projectIds: [],
};

const statusOptions: Array<{
  value: ActionItem["status"];
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function ActionItemsFilterBar({
  filters,
  onChange,
  priorities,
  projects,
}: {
  filters: ActionItemFilters;
  onChange: (filters: ActionItemFilters) => void;
  priorities: number[];
  projects: ProjectSummary[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeFilters = useMemo(
    () => filterChips(filters, projects),
    [filters, projects],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <section className="relative z-20 shrink-0 border-b bg-background px-4 py-1 md:px-6">
      <div className="flex min-w-0 items-center gap-2" ref={containerRef}>
        <Button
          variant={open ? "default" : "outline"}
          size="sm"
          className="h-7 px-2"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilters.length > 0 && (
            <span className="rounded-full bg-background/20 px-1.5 text-[0.6rem]">
              {activeFilters.length}
            </span>
          )}
        </Button>

        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex max-w-72 shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-1 pl-2.5 pr-1 text-[0.65rem] text-primary"
            >
              <span className="truncate">{filter.label}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={`Remove ${filter.label} filter`}
                onClick={() => filter.remove(onChange)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!activeFilters.length && (
            <span className="self-center text-[0.65rem] text-muted-foreground">
              Showing all items
            </span>
          )}
        </div>

        {open && (
          <div
            role="dialog"
            aria-label="Action item filters"
            className="absolute left-4 top-full mt-2 max-h-[min(70vh,36rem)] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border bg-popover p-4 text-popover-foreground shadow-2xl md:left-6"
          >
            <FilterSection title="Assignment">
              <FilterCheckbox
                checked={filters.myItems}
                label="My items"
                onChange={(checked) => onChange({ ...filters, myItems: checked })}
              />
            </FilterSection>

            <FilterSection
              title="Status"
              onClear={
                filters.statuses.length
                  ? () => onChange({ ...filters, statuses: [] })
                  : undefined
              }
            >
              <div className="grid grid-cols-2 gap-1">
                {statusOptions.map((status) => (
                  <FilterCheckbox
                    key={status.value}
                    checked={filters.statuses.includes(status.value)}
                    label={status.label}
                    onChange={() =>
                      onChange({
                        ...filters,
                        statuses: toggleValue(filters.statuses, status.value),
                      })
                    }
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection
              title="Priority"
              onClear={
                filters.priorities.length
                  ? () => onChange({ ...filters, priorities: [] })
                  : undefined
              }
            >
              {priorities.length ? (
                <div className="grid max-h-32 grid-cols-3 gap-1 overflow-y-auto">
                  {priorities.map((priority) => (
                    <FilterCheckbox
                      key={priority}
                      checked={filters.priorities.includes(priority)}
                      label={`P${priority}`}
                      onChange={() =>
                        onChange({
                          ...filters,
                          priorities: toggleValue(filters.priorities, priority),
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No priorities are in use yet.
                </p>
              )}
            </FilterSection>

            <FilterSection
              title="Project"
              onClear={
                filters.projectIds.length
                  ? () => onChange({ ...filters, projectIds: [] })
                  : undefined
              }
            >
              {projects.length ? (
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {projects.map((project) => (
                    <FilterCheckbox
                      key={project.id}
                      checked={filters.projectIds.includes(project.id)}
                      label={`${project.title}${project.status === "closed" ? " (closed)" : ""}`}
                      onChange={() =>
                        onChange({
                          ...filters,
                          projectIds: toggleValue(filters.projectIds, project.id),
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No projects are available.
                </p>
              )}
            </FilterSection>

            <div className="mt-4 flex justify-between border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    myItems: false,
                    statuses: [],
                    priorities: [],
                    projectIds: [],
                  })
                }
              >
                Clear all
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange(defaultActionItemFilters)}
              >
                Reset defaults
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FilterSection({
  title,
  onClear,
  children,
}: {
  title: string;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b py-3 first:pt-0 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {onClear && (
          <button
            type="button"
            className="text-[0.6rem] text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function FilterCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        className="h-4 w-4 accent-primary"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function filterChips(
  filters: ActionItemFilters,
  projects: ProjectSummary[],
) {
  const chips: Array<{
    key: string;
    label: string;
    remove: (onChange: (filters: ActionItemFilters) => void) => void;
  }> = [];
  if (filters.myItems) {
    chips.push({
      key: "my-items",
      label: "My items",
      remove: (onChange) => onChange({ ...filters, myItems: false }),
    });
  }
  if (filters.statuses.length) {
    const labels = statusOptions
      .filter((status) => filters.statuses.includes(status.value))
      .map((status) => status.label);
    chips.push({
      key: "status",
      label: `Status: ${labels.join(", ")}`,
      remove: (onChange) => onChange({ ...filters, statuses: [] }),
    });
  }
  if (filters.priorities.length) {
    chips.push({
      key: "priority",
      label: `Priority: ${[...filters.priorities]
        .sort((left, right) => left - right)
        .map((priority) => `P${priority}`)
        .join(", ")}`,
      remove: (onChange) => onChange({ ...filters, priorities: [] }),
    });
  }
  if (filters.projectIds.length) {
    const labels = filters.projectIds.map(
      (projectId) =>
        projects.find((project) => project.id === projectId)?.title ??
        "Unknown project",
    );
    chips.push({
      key: "project",
      label: `Project: ${labels.join(", ")}`,
      remove: (onChange) => onChange({ ...filters, projectIds: [] }),
    });
  }
  return chips;
}
