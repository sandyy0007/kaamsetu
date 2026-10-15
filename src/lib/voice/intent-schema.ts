import { z } from "zod";

export const voiceIntentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SEARCH_PROFESSIONALS"),
    profession: z.string().optional(),
    location: z.string().optional(),
    verifiedOnly: z.boolean().optional(),
    query: z.string().optional(),
  }),
  z.object({
    type: z.literal("SEARCH_JOBS"),
    profession: z.string().optional(),
    location: z.string().optional(),
    jobType: z.string().optional(),
    query: z.string().optional(),
  }),
  z.object({
    type: z.literal("SEARCH_SERVICES"),
    service: z.string().optional(),
    location: z.string().optional(),
  }),
  z.object({
    type: z.literal("OPEN_MY_PROFILE"),
  }),
  z.object({
    type: z.literal("OPEN_PROFILE"),
    profileId: z.string().optional(),
    query: z.string().optional(),
  }),
  z.object({
    type: z.literal("OPEN_FOLLOWING"),
  }),
  z.object({
    type: z.literal("OPEN_FOLLOWERS"),
  }),
  z.object({
    type: z.literal("OPEN_MESSAGES"),
  }),
  z.object({
    type: z.literal("OPEN_NOTIFICATIONS"),
  }),
  z.object({
    type: z.literal("OPEN_SAVED_ITEMS"),
  }),
  z.object({
    type: z.literal("OPEN_HOME"),
  }),
  z.object({
    type: z.literal("SEARCH_GENERAL"),
    query: z.string(),
  }),
  z.object({
    type: z.literal("UNKNOWN"),
    transcript: z.string(),
  }),
]);

export type VoiceIntent = z.infer<typeof voiceIntentSchema>;

export interface ResolvedVoiceAction {
  intent: VoiceIntent;
  targetUrl: string;
  displayTitle: string;
  displayDescription: string;
  confidence: number;
}

