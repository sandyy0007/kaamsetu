import type { SceneKind } from "@/types/domain";

const MAP: [RegExp, SceneKind][] = [
  [/wheat|barley|gehu/i, "wheat"],
  [/mustard|sarson|rapeseed/i, "mustard"],
  [/bajra|millet|jowar|sorghum/i, "bajra"],
  [/chickpea|chana|gram|moong|guar|cumin|jeera|pulse/i, "chickpea"],
  [/onion|tomato|vegetable|potato|chilli|brinjal/i, "vegetables"],
  [/milk|dairy|cow|buffalo/i, "dairy"],
  [/fruit|orange|kinnow|mango|guava|pomegranate|orchard/i, "orchard"],
  [/tractor|harvester|rotavator|thresher|sprayer|seed drill|machine/i, "tractor"],
  [/organic|natural/i, "organic"],
];

export function sceneForCrop(name?: string, fallback: SceneKind = "sunrise"): SceneKind {
  if (!name) return fallback;
  return MAP.find(([re]) => re.test(name))?.[1] ?? fallback;
}
