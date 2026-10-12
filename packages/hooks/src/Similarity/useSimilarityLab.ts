import { useCallback, useEffect, useRef, useState } from "react";
import {
  compareLab,
  getLabExperiments,
  searchLabSeeds,
  type LabComparison,
  type LabExperiment,
  type LabSeed,
  type LabTrack,
} from "@resomix/api-client";

/**
 * State for the similarity lab page: pick a seed and some experiments, run them side by side,
 * and preview any track.
 *
 * The experiment list comes from the backend, so a new experiment shows up here without a
 * frontend change. Nothing the lab does is saved anywhere.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEARCH_DEBOUNCE_MS = 350;
const DEFAULT_SELECTION = ["live", "deep_dedup"];
export const LAB_SIZES = [10, 20, 50, 100] as const;

export function useSimilarityLab() {
  const [experiments, setExperiments] = useState<LabExperiment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [seedQuery, setSeedQuery] = useState("");
  const [seedResults, setSeedResults] = useState<LabSeed[]>([]);
  const [searching, setSearching] = useState(false);
  const [seed, setSeed] = useState<LabSeed | null>(null);

  const [topSk, setTopSk] = useState<number>(100);
  const [comparison, setComparison] = useState<LabComparison | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLabExperiments().then((res) => {
      if (cancelled) return;
      const list = res.success ? res.data?.experiments ?? [] : [];
      if (!res.success) setLoadError(res.error ?? "The lab is not available on this server.");
      setExperiments(list);
      setSelected(DEFAULT_SELECTION.filter((id) => list.some((e) => e.id === id)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed search, debounced. A pasted track UUID becomes the seed directly.
  useEffect(() => {
    const q = seedQuery.trim();
    if (UUID_RE.test(q)) {
      setSeed({ id: q.toLowerCase() });
      setSeedResults([]);
      return;
    }
    if (q.length < 2) {
      setSeedResults([]);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(() => {
      searchLabSeeds(q).then((res) => {
        setSeedResults(res.success ? res.data?.tracks ?? [] : []);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [seedQuery]);

  const chooseSeed = useCallback((next: LabSeed) => {
    setSeed(next);
    setSeedResults([]);
    setSeedQuery([next.artist, next.title].filter(Boolean).join(" - "));
  }, []);

  const toggleExperiment = useCallback((id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, 4)));
  }, []);

  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }, []);

  const run = useCallback(async () => {
    if (!seed || selected.length === 0) return;
    stopPreview();
    setRunning(true);
    setRunError(null);
    // keep the experiments in the order the backend lists them, so columns never reshuffle
    const ordered = experiments.map((e) => e.id).filter((id) => selected.includes(id));
    const res = await compareLab({ track_uuid: seed.id, top_sk: topSk, experiments: ordered });
    if (res.success && res.data) {
      setComparison(res.data);
    } else {
      setComparison(null);
      setRunError(res.error ?? "The comparison failed.");
    }
    setRunning(false);
  }, [seed, selected, topSk, experiments, stopPreview]);

  const togglePreview = useCallback(
    (track: LabTrack, key: string) => {
      if (playingId === key) {
        stopPreview();
        return;
      }
      audioRef.current?.pause();
      if (!track.preview_url) return;
      const audio = new Audio(track.preview_url);
      audio.onended = () => setPlayingId((cur) => (cur === key ? null : cur));
      audioRef.current = audio;
      setPlayingId(key);
      audio.play().catch(() => setPlayingId(null));
    },
    [playingId, stopPreview],
  );

  useEffect(() => () => audioRef.current?.pause(), []);

  return {
    experiments,
    selected,
    toggleExperiment,
    loadError,
    seedQuery,
    setSeedQuery,
    seedResults,
    searching,
    seed,
    chooseSeed,
    topSk,
    setTopSk,
    run,
    running,
    runError,
    comparison,
    playingId,
    togglePreview,
  };
}

/** Everything the lab page renders from, for typing its components. */
export type SimilarityLabState = ReturnType<typeof useSimilarityLab>;
