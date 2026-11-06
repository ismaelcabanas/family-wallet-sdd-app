import type { PlannedMovement } from "./sheet-import-plan";

export interface ExecutableImportPlan {
  accountId: number;
  movements: PlannedMovement[];
  tagsToCreate: { name: string; categoryId: number }[];
}

export interface SheetImportRepository {
  persist(plan: ExecutableImportPlan): Promise<{ movementsCreated: number; tagsCreated: number }>;
}
