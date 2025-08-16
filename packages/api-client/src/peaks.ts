import { SERVER_MEDIA } from "@resomix/config";

export interface PeaksApiResponse {
  peaks: number[];
  duration: number;
}

/**
 * Fetch precomputed waveform peaks for a given track ID.
 *
 * @param trackId - UUID of the track
 * @returns Peaks array and duration
 */
export async function getTrackPeaks(trackId: string): Promise<PeaksApiResponse> {
  const url = `${SERVER_MEDIA}/peaks/?uuid=${trackId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch peaks (${res.status})`);
  }
  return res.json() as Promise<PeaksApiResponse>;
}
