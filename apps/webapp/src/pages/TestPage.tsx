import React, { useState, useEffect } from "react";
import InputPlayer from "@/components/Playlist/InputPlayer.tsx";
import {useGlobalHowlerController} from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";

const TestPage: React.FC = () => {
  const [play, setPlay] = useState(false);
  const howlerController = useGlobalHowlerController();
  const setHowlerController = usePlayerStore((s) => s.setHowlerController);

  // Initialize global controller
  useEffect(() => {
    setHowlerController(howlerController);
  }, [howlerController, setHowlerController]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[var(--color-primary-background)] text-[var(--color-primary)] flex flex-col gap-[var(--px-40)] justify-start items-start p-[var(--px-40)]">
      <div className="w-full h-full gap-[var(--px-20)] flex flex-col">
        <div className="max-w-[var(--px-250)] lg:max-w-[var(--px-500)] h-[var(--px-50)] overflow-y-hidden bg-[var(--color-secondary)]">
          <InputPlayer
            trackId="1a9983daf38caac5a8e8adaf"
            totalDuration={482}
          />
        </div>
        {/* Display a button saying play, that changes its value to pause based on state */}
        <button className="w-[var(--px-100)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer" onClick={() => setPlay(!play)}>
          {play ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
};

export default TestPage;
