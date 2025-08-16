import React from "react";
import WaveformPlayer from "./WaveformPlayer.tsx";

interface SimilarityPlayerProps {
    trackId: string;
}

const SimilarityPlayer: React.FC<SimilarityPlayerProps> = ({ trackId }) => {
    return (
        <div>
            <WaveformPlayer 
                trackId={trackId}
            />
        </div>
    );
};

export default SimilarityPlayer;
