import type { StudentProfile } from "./studentProfile.ts";
import type { Preferences, Guidance, ResultCount } from "./preferences.ts";
/** A single synthetic catalog update from data/updates.json. */
export interface EventUpdate {
  id: string;
  event_id: string;
  kind: "cancelled" | "full" | "time_moved" | "room_changed";
  timestamp: string;
  details: string;
  new_start?: number;
  new_end?: number;
  new_location?: string;
}

export interface UpdateBatch {
  batch: number;
  label: string;
  timestamp: string;
  updates: EventUpdate[];
}

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
  applied_update_ids?: string[];
  view_excluded?: string[];
  plan: string[];
  cancelled: string[];
  interests: string[];
  blocks: TimeSlot[];
  buffer: number;
  preferred_time: string;
  preferences?: Omit<RecommendationPreferences, "guidance">;
}
export interface AccessConditions {
  membership: boolean | string;
  min_age: number | string;
  ticket: boolean | string;
  capacity: number | string;
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
  host_school?: string;
  goal_type?: string[];
  access_conditions?: AccessConditions;
}
export interface Schedule {
  /** Transient Dashboard category/query projection; never a saved dismissal. */
  view_excluded?: string[];
  plan: string[];
  cancelled: string[];
  interests: string[];
  blocks: Block[];
  buffer: number;
  preferred_time?: string;
  preferences?: Preferences;
  /** Applied synthetic update IDs (see updates.ts); absent means none. */
  appliedUpdateIds?: string[];
}
/** Omitted mode means overlap-free plan-building in both planners. Discovery is explicit. */
export type RecommendationMode = "discovery" | "plan-building";
export interface Constraints {
  mode?: RecommendationMode;
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
export interface RecommendationMatchResult {
  event_id: string;
  score: number;
  matches: import("./planner.ts").RecommendationMatch[];
}
export interface Message {
  role: "user" | "assistant";
  text: string;
  eventIds?: string[];
  /** Event IDs that overlap the conflict-free picks; shown as "Also at the same time" cards. */
  overlapIds?: string[];
  /** Event IDs for no-match alternatives (one filter dropped); shown as suggestion cards. */
  altIds?: string[];
  /** Clickable example prompts shown as buttons below the message text (e.g. for "limited demo" hint). */
  examples?: string[];
  evidence?: RecommendationEvidence[];
  settingsKey?: string;
  recommendationMode?: RecommendationMode;
  resolvedConstraints?: Constraints;
  matchReasons?: RecommendationMatchResult[];
}
export interface Post {
  id: string;
  name: string;
  title: string;
  body: string;
  tag: string;
  communityId?: string;
}
export interface ForumComment {
  postId: string;
  name: string;
  text: string;
}
export interface PostDraft {
  title: string;
  body: string;
  communityId: string;
}
/** Goal-type categories that the student can select in their profile. */
export const GOAL_TYPES = [
  "research",
  "industry",
  "social connection",
  "cultural exploration",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export interface DemoState extends Schedule {
  studentProfile?: StudentProfile;
  profileRankingConsent?: boolean;
  /** Distinguishes main's untouched Home default mix from explicitly saved preference count. */
  preferencesConfigured?: boolean;
  name: string;
  /** Demo sign-in only: no account or password; the profile stays local. */
  signedIn: boolean;
  onboarded: boolean;
  major: string;
  goals: string;
  /** Goal-type interests selected in profile; used by watsonx ranking. */
  goal_types: string[];
  timezone: string;
  saved: string[];
  rsvps: string[];
  joined: string[];
  joinedCommunities: string[];
  posts: Post[];
  comments: ForumComment[];
  /** Forum likes saved in this browser: "post:<id>" or "comment:<postId>:<index>". */
  likes: string[];
  postDraft: PostDraft | null;
  draft: string[];
  constraints: Constraints;
  messages: Message[];
  /** IDs of EventUpdate entries that have been applied to the local demo state. */
  appliedUpdateIds: string[];
  /** ISO timestamp of the last time the student clicked "Check for updates". Null = never checked. */
  lastUpdateCheck: string | null;
  /** IDs of notifications the student has opened or marked as read. */
  readNotificationIds: string[];
}
export interface PlanResponse {
  mode: "simulated" | "watsonx";
  understood: boolean;
  clarification?: string | null;
  diagnostic?: string | null;
  provider: string;
  constraints: Constraints;
  event_ids: string[];
  notice?: string;
  recommendations?: RecommendationEvidence[];
  match_reasons?: RecommendationMatchResult[];
  /** @deprecated Read-only compatibility with older Rust responses. Not emitted by current servers. */
  matchReasons?: RecommendationMatchResult[];
  /** "watsonx" when AI narrative reasons were used; "template" when template evidence. */
  explanations?: "watsonx" | "template";
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
  learning_connection?: string;
  participation_fit?: string;
  constraints_satisfied?: Constraints;
  /** AI-written reason from IBM watsonx (Granite). Present only on watsonx-ranked results. */
  ai_reason?: string;
  /** Catalog fields the model cited when writing ai_reason. */
  cited_fields?: string[];
}
