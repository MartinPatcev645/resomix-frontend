/** Verbatim operational copy from preview.html — do not paraphrase. */
export const WORKSPACE_HEADING = "Start with a track.";
export const WORKSPACE_SUBLINE =
  "Find what belongs near it — or understand what is inside it.";

export const LOOP_STRIP_TEXT =
  "Reference → find similar → audition → analyse → use as new reference";

export const DISCOVERY_TASK_TITLE = "Find similar tracks";
export const DISCOVERY_TASK_DESC =
  "Go from one reference to a ranked working shortlist you can audition.";

export const ANALYSIS_TASK_TITLE = "Analyse a track";
export const ANALYSIS_TASK_DESC =
  "Read the track before deciding where it belongs.";

export const ACTIVE_TASK_LABEL = "Active task";

export const SOURCE_TAB_SEARCH = "Search a known track";
export const SOURCE_TAB_UPLOAD = "Upload a reference";

export const TRY_EXAMPLE_HINT = "No track in mind?";
export const TRY_EXAMPLE_ACTION = "Try an example";

export const UPLOAD_PRIVACY_NOTE =
  "Temporary reference audio is processed privately and the uploaded source is deleted no later than 24 hours after upload or analysis. It is not made public, not shared with other users, and not used to train or fine-tune PYXIS-1.";

export const ANALYSIS_GATE_BODY =
  "Track analysis runs on your own uploads and is tied to your account's monthly upload allowance.";

export const ANALYSIS_GATE_CTA = "Sign in to analyse a track";

export const ANALYSIS_GATE_PRIVACY =
  "Analysis uploads follow the same handling: deleted no later than 24 hours after upload or analysis, never public, never used to train or fine-tune PYXIS-1.";

export const LOOP_STRIP_STORAGE_KEY = "workspace_loop_strip_dismissed";

export const FIND_SIMILAR_CTA = "Find similar tracks";

export const DEPTH_LABEL = "Results";

export const REFERENCE_CHANGE = "Change";

export const PROCESSING_STEPS_CATALOGUE = [
  "Preparing reference",
  "Searching the index",
  "Building ranked results",
] as const;

export const PROCESSING_STEPS_UPLOAD = [
  "Preparing reference",
  "Analysing upload",
  "Searching the index",
  "Building ranked results",
] as const;

export const PROCESSING_NOTE =
  "Catalogue references typically return in ~1–2 s; uploads in ~10–15 s depending on load. Observed, not a service-level commitment.";

export const ANALYSIS_UPLOAD_HEADING = "Drop a track to analyse";
export const ANALYSIS_UPLOAD_FORMAT = "MP3 · WAV · FLAC · AIFF — up to 100 MB";
export const ANALYSIS_UPLOAD_QUOTA_HINT =
  "Counts against your monthly upload allowance.";
export const ANALYSE_TRACK_CTA = "Analyse track";

export const ANALYSIS_PROCESSING_STEPS = [
  "Queued",
  "Processing — PYXIS-1 full analysis",
  "Completed",
] as const;

export const ANALYSIS_PROCESSING_NOTE =
  "Asynchronous job — partial results can arrive first and are normal. A failed state is reported with a retry.";

export const ANALYSIS_SUMMARY_HEADING = "Analysis complete";
export const FIND_SIMILAR_FROM_ANALYSIS_CTA = "Find similar tracks";
export const OPEN_FULL_INTELLIGENCE_CTA = "Open full Track Intelligence";
export const ANALYSE_ANOTHER_CTA = "Analyse another track";
export const ANALYSIS_SIBLING_PLAYLIST_NOTE =
  "“Find similar tracks” opens this upload's sibling similarity playlist — live today.";
export const ANALYSIS_SIBLING_PLAYLIST_UNAVAILABLE =
  "Similarity playlist unavailable for this analysis";
export const ANALYSIS_SIBLING_PLAYLIST_LEGACY =
  "No sibling similarity playlist is linked to this analysis — common for uploads before automatic playlist pairing.";

export const READING_TAB_DJ = "For DJs";
export const READING_TAB_PRODUCER = "For producers";
export const READING_TAB_CURATOR = "For curators";

/** Non-claim closers — verbatim from approved preview; do not paraphrase. */
export const READING_CLOSER_DJ =
  "No mix points, transitions or compatibility are inferred — set decisions stay yours.";
export const READING_CLOSER_PRODUCER =
  "No editing, mastering or production-quality advice is produced.";
export const READING_CLOSER_CURATOR =
  "Signals describe the audio — commercial performance is not predicted.";
