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

  const handleHlsRequest = async () => {
    try {
      // 88741ea8-abe3-4d25-808a-3428e8531b02
      // 71a7fdf0-ac11-4a36-8d68-c13204d7b983
      const url = new URL('https://bserver.resomix.com/playlists/similarity-hls/88741ea8-abe3-4d25-808a-3428e8531b02.m3u8');
      url.searchParams.append('api_key', 'bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ');
      
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/vnd.apple.mpegurl'
        }
      });
      const data = await response.text();
      console.log('HLS Response:', data);
    } catch (error) {
      console.error('Error fetching HLS:', error);
    }
  };

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
        {/* Button to make HLS request */}
        <button 
          className="w-[var(--px-150)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer" 
          onClick={handleHlsRequest}
        >
          Fetch HLS
        </button>
      </div>
    </div>
  );
};

export default TestPage;
