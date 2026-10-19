import { fresh } from "./state.ts";
export function guidedScenario() {
  const state = fresh();
  return {
    ...state,
    onboarded: true,
    name: "Demo explorer",
    major: "Learning sciences; curious about data and other disciplines",
    goals: "Explore research, career paths and social connections",
    interests: ["AI & education", "Career", "Social"],
    preferred_time: "afternoon",
    blocks: state.blocks,
  };
}
export const GUIDED_PROMPT = "AI career social 3 events after 1 PM";
