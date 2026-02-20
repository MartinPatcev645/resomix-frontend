/**
 * Generates a random session ID in the format RPX_XXXXX
 * where XXXXX are 5 uppercase alphanumeric characters.
 */
export const fetchSessionId = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RPX_${result}`;
};

/**
 * Generates a random time string within 20 minutes.
 * Possible formats: "Xs", "Xm", "Xm Xs"
 */
export const fetchGenerationTime = (): string => {
  const totalSeconds = Math.floor(Math.random() * 1200) + 1; // 1s to 20m (1200s)
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  } else if (seconds === 0) {
    return `${minutes}m`;
  } else {
    return `${minutes}m ${seconds}s`;
  }
};
