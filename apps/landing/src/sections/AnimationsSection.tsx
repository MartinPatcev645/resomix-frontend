import React from "react";
import purpleAnimationGif from "../assets/gifs/purple_animation.gif";

const AnimationsSection: React.FC = () => {
  return (
    <>
      {/* Purple Animation Background */}
      <div
        style={{
          backgroundImage: `url(${purpleAnimationGif})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          position: 'absolute',
          width: '550px',
          height: '550px',
          top: '1750px',
          left: '50%',
          opacity: 0.4,
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
        }}
      />
      {/* Add more animations here as needed */}
    </>
  );
};

export default AnimationsSection;
