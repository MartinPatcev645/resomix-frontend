import React from "react";
import LayersSvg from "../assets/icons/layers.svg";
import VerticalLineSvg from "../assets/icons/vertical_line.svg";
import purpleAnimationGif from "../assets/gifs/purple_animation.gif";

const SectionTwo: React.FC = () => (
  <div className='mt-[450px] relative  px-[65px]'>
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
        top: '30%',
        left: '50%',
        opacity: 0.4,
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
      }}
    />
    {/* Content with higher z-index */}
    <div className='flex flex-col justify-between items-center relative z-15'>
      <div className=''></div>
      <div className='flex flex-col justify-center items-center'>
        <div className=''>
          <img src={LayersSvg} alt="Layers" />
        </div>
        <div className="text-center justify-start text-[13px] font-extralight font-auger mt-6 leading-4 opacity-70">Resomix goes deeper than anyone else, carefully selecting music <br />that reflects the energy and vibe you're looking for,<br />with a quality-over-quantity approach.</div>
      </div>
      <div className='my-8'>
        <img src={VerticalLineSvg} alt="Vertical Line" />
      </div>
      <div className="opacity-80 justify-start text-white text-[7px] font-light font-fira tracking-widest">instant_inspiration.module[active]</div>
    </div>
  </div>
);

export default SectionTwo;
