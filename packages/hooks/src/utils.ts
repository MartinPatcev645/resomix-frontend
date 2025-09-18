import React from "react";

// function to Convert seconds to hours, minutes and seconds
export function formatDuration(seconds: number): string {
  if (seconds < 0) return "0:00";
  
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  
  if (hours > 0) {
    // Format: "H:MM:SS"
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else if (minutes > 0) {
    // Format: "M:SS"
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    // Format: "0:SS"
    return `0:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Function to convert 0-1 points into a percentage
export function formatPercentage(percentage: number, decimals: number = 2): string {
  return `${(percentage * 100).toFixed(decimals)}%`;
}
