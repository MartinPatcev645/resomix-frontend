import React from "react";
import WaveformPlayer from "./WaveformPlayer.tsx";

interface SimilarityPlayerProps {
    trackId: string;
    isPlaying?: boolean;
}

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId, isPlaying = false }) => {
    return (
        <div>
            <WaveformPlayer 
                trackId={trackId}
                isPlaying={isPlaying}
                autoPlay={true}
            />
        </div>
    );
};

export default SimilarityPlayer;
