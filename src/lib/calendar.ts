import { CROPS, type CropId } from "@/data/crops";
import { TASKS, type TaskKind, type WeatherNeed } from "@/data/tasks";
import type { PlanResult } from "./plan";

export interface FarmTask {
  id: string;
  crop: CropId;
  kind: TaskKind;
  title: string;
  detail: string;
  start: string; // YYYY-MM-DD
  end: string;
  weather: WeatherNeed;
}

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);

/** Turn the season plan's dates into a dated task list for every crop. */
export function buildCalendar(plan: PlanResult): FarmTask[] {
  const tasks: FarmTask[] = [];
  for (const d of plan.details) {
    const a = d.allocation;
    const anchors = { plant: a.plantFrom, nursery: a.nurseryStart || a.plantFrom, harvest: d.harvestFrom };
    for (const t of TASKS[a.crop]) {
      const start = addDays(anchors[t.anchor], t.offset);
      // The planting task spans the farmer's whole planting window.
      const end = t.kind === "plant" ? a.plantTo : addDays(start, t.days - 1);
      tasks.push({
        id: `${a.crop}:${t.id}`,
        crop: a.crop,
        kind: t.kind,
        title: `${t.title}${t.kind === "plant" || t.kind === "harvest" ? "" : ` (${CROPS[a.crop].name})`}`,
        detail: t.detail,
        start,
        end,
        weather: t.weather,
      });
    }
  }
  return tasks.sort((x, y) => x.start.localeCompare(y.start));
}

export function seasonSpan(tasks: FarmTask[]) {
  return { from: tasks[0]?.start ?? "", to: tasks.reduce((m, t) => (t.end > m ? t.end : m), "") };
}
