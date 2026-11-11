---
target: Campus Compass site
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/judyzhou/code/ibm-campus_compass/frontend/src/App.tsx"
target_fingerprint: "sha256:6c21ccfef20971ca932ac7710644f3c405b6a3ccea645e2c4d352b726e73940c"
target_path: /Users/judyzhou/code/ibm-campus_compass/frontend/src/App.tsx
timestamp: 2026-11-11T00-21-33Z
slug: frontend-src-app-tsx
---
Campus Compass critique, 2026-11-10. Score 24/40 (Acceptable). Method: dual-agent.
P1: AI Planner leads with presenter launcher; date/"today" contradiction (header Nov 10 vs week Nov 2-6, today hard-coded index 0, pill overflow); add-to-calendar finish (focus lost to body, 5s toast, no undo/view link).
P2: planner evidence is backend jargon + whole log aria-live; conflicting events show enabled Add; tiny text 8-9px and muted labels fail AA on tinted slots; dashboard overload / 3 CTAs to planner; Back doesn't close event detail; mobile tap targets <44px; a11y structure (h3 in button, no skip link, static document.title, heading skips, non-inert background); forum copy contradicts catalog; profile unsaved edits lost silently.
P3: pluralization, title case, 24h times, "Welcome back" on first visit, Settings Team tools above h1, arts tags labelled Social, placeholder 3.9:1, redundant mascot alt, unactionable NOT CONNECTED tiles.
