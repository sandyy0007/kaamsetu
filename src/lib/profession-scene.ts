import type { SceneKind } from "@/types/domain";

/** Default procedural artwork per profession (no stock photos). Shared by server DTOs and client headers. */
const SCENE_BY_PROFESSION: Record<string, SceneKind> = {
  pr_electrician: "workshop", pr_electronics_tech: "digital", pr_computer_tech: "digital", pr_mobile_tech: "digital", pr_ac_tech: "workshop",
  pr_carpenter: "carpentry", pr_mason: "construction", pr_painter: "construction", pr_plumber: "construction", pr_welder: "workshop", pr_mechanic: "tractor",
  pr_driver: "road", pr_tailor: "tailoring", pr_potter: "pottery", pr_weaver: "tailoring", pr_handicraft: "pottery", pr_leather: "tailoring",
  pr_tutor: "classroom", pr_freelancer: "digital", pr_photographer: "sunrise", pr_farmer: "wheat", pr_farm_worker: "wheat", pr_dairy_worker: "dairy", pr_tractor_operator: "tractor", pr_agri_technician: "irrigation", pr_agri_expert: "classroom",
  pr_cook: "market", pr_barber: "market", pr_beautician: "tailoring", pr_cleaner: "health",
};
const BY_DASHBOARD: Record<string, SceneKind> = { TRADE: "workshop", TECH: "digital", ARTISAN: "pottery", SERVICE: "market", INDEPENDENT: "classroom", AGRI_WORK: "wheat", FARMER: "wheat" };

export function sceneForProfession(professionId: string, dashboard?: string): SceneKind {
  return SCENE_BY_PROFESSION[professionId] ?? BY_DASHBOARD[dashboard ?? ""] ?? "sunrise";
}
