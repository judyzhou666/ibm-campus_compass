import type { Preferences, Guidance, ResultCount } from "./preferences.ts";
export interface TimeSlot {
  day: number;
  start: number;
  end: number;
}
export interface Block extends TimeSlot {
  id: string;
  title: string;
}
export type ParticipationChoice =
  "independent" | "one-to-one" | "small-group" | "open";
export type ParticipationFormat = ParticipationChoice | "unknown";
/** Minimal v1 API projection: local notes, provenance and consent flags stay local. */
export interface RecommendationPreferences {
  version: 1;
  goal_topics: string[];
  primary_topics: string[];
  learning_topics: string[];
  participation: ParticipationChoice[];
  guidance: Guidance;
  count: ResultCount;
  free_only: boolean;
  windows: TimeSlot[];
  dismissed: string[];
}
export interface RecommendationSchedule {
  plan: string[];
  cancelled: string[];
  interests: string[];
  blocks: TimeSlot[];
  buffer: number;
  preferred_time: string;
  preferences?: Omit<RecommendationPreferences, "guidance">;
}
export interface CampusEvent extends TimeSlot {
  id: string;
  title: string;
  category: string;
  location: string;
  topic: string;
  food: string;
  cost: number;
  access: string;
  description: string;
  poster: string;
  participation?: ParticipationFormat;
  source: string;
  checked: string;
  rsvp: string;
  campus_id?: string;
  source_url?: string | null;
  last_checked_at?: string | null;
  intended_audience?: string;
  eligibility?: string;
  availability?: string;
  verification_status?: string;
  food_status?: string;
}
export interface Schedule {
  plan: string[];
  cancelled: string[];
  interests: string[];
  blocks: Block[];
  buffer: number;
  preferred_time?: string;
  preferences?: Preferences;
}
export interface Constraints {
  topics?: string[];
  excluded?: string[];
  days?: number[];
  after?: number;
  before?: number;
  food?: string;
  free?: boolean;
  limit?: number;
  explore?: boolean;
}
export interface Message {
  role: "user" | "assistant";
  text: string;
  eventIds?: string[];
  evidence?: RecommendationEvidence[];
}
export interface Post {
  name: string;
  title: string;
  body: string;
  tag: string;
}
export interface DemoState extends Schedule {
  name: string;
  onboarded: boolean;
  major: string;
  goals: string;
  saved: string[];
  rsvps: string[];
  joined: string[];
  joinedCommunities: string[];
  posts: Post[];
  draft: string[];
  constraints: Constraints;
  messages: Message[];
}
export interface PlanResponse {
  mode: "simulated";
  understood: boolean;
  clarification?: string | null;
  diagnostic?: string | null;
  provider: string;
  constraints: Constraints;
  event_ids: string[];
  recommendations?: RecommendationEvidence[];
  matchReasons?: {
    event_id: string;
    score: number;
    matches: import("./planner.ts").RecommendationMatch[];
  }[];
}

export interface Rsvp {
  display_name: string;
  attending: boolean;
}

export interface RecommendationEvidence {
  event_id: string;
  interest_match: string;
  schedule_fit: string;
  practical: string;
  trade_offs: string;
  comparison?: string;
  discovery_context?: string;
}
