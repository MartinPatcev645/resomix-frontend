import React from "react";
import WaveformPlayer from "./WaveformPlayer.tsx";

interface InputPlayerProps {
    trackId: string;
}

const InputPlayer: React.FC<InputPlayerProps> = ({ trackId }) => {
    return (
        <div>
            <WaveformPlayer 
                trackId={trackId}
            />
        </div>
    );
};

export default InputPlayer;
