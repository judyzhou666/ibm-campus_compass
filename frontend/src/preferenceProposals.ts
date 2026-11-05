import { createStore, type DemoStore } from "./state.ts";
import { migratePreferences, proposalTopic } from "./preferences.ts";
import type { DemoState } from "./types.ts";
export interface PendingPreferenceProposal {
  id: number;
  text: string;
  topics: string[];
  revision: string;
}
/** Transient identity only; never stored or sent to the recommendation service. */
export const proposalRevision = (state: DemoState) =>
  JSON.stringify([
    state.interests,
    state.preferences,
    state.preferred_time,
    state.buffer,
    state.blocks,
  ]);
export function proposalChanges(
  proposal: PendingPreferenceProposal,
  state: DemoState,
) {
  const p = migratePreferences(state.preferences);
  const existing = p.learning_topics.map((t) => t.topic);
  return {
    additions: proposal.topics.filter((t) => !existing.includes(t)),
    existing: proposal.topics.filter((t) => existing.includes(t)),
    enabledTopics: [...new Set([...existing, ...proposal.topics])],
    alreadyEnabled: p.use_learning,
  };
}
export function createPreferenceProposals(demo: DemoStore) {
  let sequence = 0;
  const pending = createStore<PendingPreferenceProposal | null>(null);
  let unsubscribe: (() => void) | undefined;
  function dismiss(id?: number) {
    if (id !== undefined && pending.read()?.id !== id) return;
    sequence++;
    unsubscribe?.();
    unsubscribe = undefined;
    pending.update(() => null);
  }
  function current(id: number) {
    const p = pending.read();
    if (!p || p.id !== id) return null;
    if (p.revision !== proposalRevision(demo.read())) {
      dismiss(id);
      return null;
    }
    return p;
  }
  return {
    read: pending.read,
    subscribe: pending.subscribe,
    dismiss,
    dispose: () => dismiss(),
    propose(text: string) {
      const proposal = {
        id: ++sequence,
        text,
        topics: proposalTopic(text),
        revision: proposalRevision(demo.read()),
      };
      unsubscribe?.();
      unsubscribe = demo.subscribe(() => {
        const p = pending.read();
        if (p && p.revision !== proposalRevision(demo.read())) dismiss(p.id);
      });
      pending.update(() => proposal);
      return proposal;
    },
    useOnce(id: number) {
      const p = current(id);
      if (!p || !p.topics.length) return null;
      const constraints = { ...demo.read().constraints, topics: [...p.topics] };
      delete constraints.explore;
      dismiss(id);
      return { text: p.text, constraints };
    },
    confirm(id: number) {
      const proposal = current(id);
      if (!proposal || !proposal.topics.length) return false;
      dismiss(id); // Consume before updating; the same confirmation can never run twice.
      demo.update((state) => {
        const p = migratePreferences(state.preferences);
        const additions = proposal.topics.filter(
          (t) => !p.learning_topics.some((existing) => existing.topic === t),
        );
        return {
          ...state,
          preferences: {
            ...p,
            use_learning: true,
            learning_topics: [
              ...p.learning_topics,
              ...additions.map((topic) => ({
                topic,
                source: "Confirmed from a conversation" as const,
              })),
            ],
          },
          draft: [],
        };
      });
      return true;
    },
  };
}
