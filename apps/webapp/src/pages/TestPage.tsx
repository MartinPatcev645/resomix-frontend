import React, { useState, useEffect } from "react";
import WaveformPlayer from "@/components/Playlist/WaveformPlayer.tsx";

const TestPage: React.FC = () => {
  const [play, setPlay] = useState(false);
  const [playLocal, setPlayLocal] = useState(false);

  // Local file handling
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // When a new file is chosen create / revoke an object URL so it can be
  // consumed by the waveform player.
  useEffect(() => {
    if (!file) {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      setFileUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setFileUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[var(--color-primary-background)] text-[var(--color-primary)] flex flex-col gap-[var(--px-40)] justify-start items-start p-[var(--px-40)]">
      <div className="w-full h-full gap-[var(--px-20)] flex flex-col">
        <div className="max-w-[var(--px-250)] lg:max-w-[var(--px-500)] h-[var(--px-50)] overflow-y-hidden bg-[var(--color-secondary)]">
          <WaveformPlayer
            duration={482}
            trackId="67ad9cec799206f8d64acdf1"
            isPlaying={play}
          />
        </div>
        {/* Display a button saying play, that changes it's value to pause based on state */}
        <button className="w-[var(--px-100)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer" onClick={() => setPlay(!play)}>
          {play ? "Pause" : "Play"}
        </button>
      </div>
      <div className="w-full h-full gap-[var(--px-20)] flex flex-col">
        <div className="max-w-[var(--px-250)] lg:max-w-[var(--px-500)] h-[var(--px-50)] overflow-y-hidden bg-[var(--color-secondary)]">
          {fileUrl ? (
            <WaveformPlayer
              audioUrl={fileUrl}
              isPlaying={playLocal}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
              Select a file below to preview
            </div>
          )}
        </div>
        {/* Display a button saying play, that changes it's value to pause based on state */}
        <button className="w-[var(--px-100)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer" onClick={() => setPlayLocal(!playLocal)}>
          {playLocal ? "Pause" : "Play"}
        </button>
      </div>
      {/* Button to upload an audio file here*/}
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          // Reset playback state when choosing a new file
          setPlayLocal(false);
        }}
      />
    </div>
  );
};

export default TestPage;
