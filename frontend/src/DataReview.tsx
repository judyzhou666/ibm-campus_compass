import { useState } from "react";
import { EVENTS } from "./data.ts";
import { DEMO } from "./config.ts";
import {
  qualityIssues,
  REVIEW_CATEGORIES,
  type ReviewCategory,
} from "./quality.ts";
import { Button, Heading } from "./components.tsx";
export function DataReview({
  onDetail,
  onExit,
}: {
  onDetail: (id: string) => void;
  onExit: () => void;
}) {
  const [filter, setFilter] = useState<ReviewCategory | "All">("All");
  const records = EVENTS.map((e) => ({ e, issues: qualityIssues(e) }));
  return (
    <>
      <Heading
        title="Synthetic-data review"
        description="Team review workspace · Read only · Not a university administration system"
      />
      <Button onClick={onExit}>Return to student dashboard</Button>
      <section className="panel briefing">
        <p>
          Reference date: {DEMO.week_start}. Timestamps older than 30 days,
          missing, invalid or in the future need review. A fictional authoring
          date is not external verification.
        </p>
        <p>
          {records.length} records ·{" "}
          {records.filter((r) => r.issues.length).length} need review ·{" "}
          {records.reduce((sum, r) => sum + r.issues.length, 0)} issue flags
        </p>
        <div className="filters">
          <button
            className={`chip ${filter === "All" ? "active" : ""}`}
            onClick={() => setFilter("All")}
            aria-pressed={filter === "All"}
          >
            All records
          </button>
          {REVIEW_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`chip ${filter === c ? "active" : ""}`}
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
            >
              {c}: {records.filter((r) => r.issues.includes(c)).length}
            </button>
          ))}
        </div>
        <p>
          Action: inspect the record, then propose a catalog correction through
          a reviewed Doris commit and run the Rust/API checks. This view cannot
          edit or verify records. Missing external links are expected for
          fictional events; do not fabricate them.
        </p>
        {records
          .filter((r) => filter === "All" || r.issues.includes(filter))
          .map(({ e, issues }) => (
            <article className="review-record" key={e.id}>
              <h3>
                <button className="text-btn" onClick={() => onDetail(e.id)}>
                  {e.id} · {e.title}
                </button>
              </h3>
              <p>
                {issues.join(" · ") ||
                  "No automatic flags; human review still required."}
              </p>
            </article>
          ))}
      </section>
    </>
  );
}
