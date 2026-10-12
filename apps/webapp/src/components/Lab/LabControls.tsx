import { LAB_SIZES, type SimilarityLabState } from "@resomix/hooks";
import {
  PAGE_BTN_PRIMARY,
  PAGE_BTN_SECONDARY,
  PAGE_FIELD,
  PAGE_FIELD_LABEL,
  PAGE_KICKER,
  PAGE_PANEL,
  PAGE_ROW_META,
  PAGE_ROW_TITLE,
} from "@resomix/ui";

const ACTIVE = "border-[var(--rx-color-accent)] text-[var(--rx-color-accent)]";

/** Seed, playlist size and experiments for the similarity lab, plus the Compare button. */
export function LabControls({ lab }: { lab: SimilarityLabState }) {
  const canRun = Boolean(lab.seed) && lab.selected.length > 0 && !lab.running;

  return (
    <section className={`${PAGE_PANEL} flex flex-col gap-[var(--px-18)]`}>
      <div className="flex flex-col gap-[var(--px-6)]">
        <h1 className={PAGE_KICKER}>Similarity lab</h1>
        <p className={`${PAGE_ROW_META} m-0`}>
          Compare today's playlist for a track with experimental search settings, side by side. Read
          only. Nothing is saved, and no search counts against any plan.
        </p>
      </div>

      {lab.loadError ? (
        <p className="m-0 font-fira text-[length:var(--px-11)] text-[var(--rx-color-error)]">{lab.loadError}</p>
      ) : null}

      <div className="relative flex flex-col gap-[var(--px-6)]">
        <label htmlFor="lab-seed" className={PAGE_FIELD_LABEL}>
          Seed track
        </label>
        <input
          id="lab-seed"
          className={PAGE_FIELD}
          placeholder="Search artist or title, or paste a track ID"
          value={lab.seedQuery}
          onChange={(e) => lab.setSeedQuery(e.target.value)}
          autoComplete="off"
        />
        {lab.seedResults.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-40 m-0 mt-[var(--px-4)] max-h-[var(--px-320)] list-none overflow-y-auto border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-0">
            {lab.seedResults.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => lab.chooseSeed(s)}
                  className="flex w-full cursor-pointer flex-col items-start border-0 border-b border-dotted border-[var(--rx-color-border-subtle)] bg-transparent px-[var(--px-12)] py-[var(--px-8)] text-left text-[var(--rx-color-text-primary)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  <span className={PAGE_ROW_TITLE}>{s.title ?? s.id}</span>
                  <span className={PAGE_ROW_META}>{s.artist ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <span className={PAGE_ROW_META}>
          {lab.searching ? "Searching the catalogue…" : lab.seed ? `Seed: ${lab.seed.id}` : "No seed chosen yet"}
        </span>
      </div>

      <div className="flex flex-col gap-[var(--px-6)]">
        <span className={PAGE_FIELD_LABEL}>Playlist size</span>
        <div className="flex flex-wrap gap-[var(--px-8)]">
          {LAB_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={lab.topSk === n}
              onClick={() => lab.setTopSk(n)}
              className={`${PAGE_BTN_SECONDARY} ${lab.topSk === n ? ACTIVE : ""}`}
            >
              {n} tracks
            </button>
          ))}
        </div>
      </div>

      <fieldset className="m-0 flex flex-col gap-[var(--px-8)] border-0 p-0">
        <legend className={`${PAGE_FIELD_LABEL} mb-[var(--px-6)]`}>Experiments, up to four</legend>
        {lab.experiments.map((e) => {
          const on = lab.selected.includes(e.id);
          return (
            <label
              key={e.id}
              htmlFor={`lab-exp-${e.id}`}
              className={`flex cursor-pointer gap-[var(--px-12)] border border-dotted p-[var(--px-12)] ${
                on ? "border-[var(--rx-color-accent)]" : "border-[var(--rx-color-border-default)]"
              }`}
            >
              <input
                id={`lab-exp-${e.id}`}
                type="checkbox"
                checked={on}
                onChange={() => lab.toggleExperiment(e.id)}
                className="mt-[var(--px-2)] accent-[var(--rx-color-accent)]"
              />
              <span className="flex flex-col gap-[var(--px-2)]">
                <span className={`${PAGE_ROW_TITLE} text-[var(--rx-color-text-primary)]`}>{e.label}</span>
                <span className={PAGE_ROW_META}>{e.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap items-center gap-[var(--px-12)]">
        <button type="button" onClick={lab.run} disabled={!canRun} className={PAGE_BTN_PRIMARY}>
          {lab.running ? "Comparing…" : "Compare"}
        </button>
        {lab.runError ? (
          <span className="font-fira text-[length:var(--px-11)] text-[var(--rx-color-error)]">{lab.runError}</span>
        ) : null}
      </div>
    </section>
  );
}
