import React from "react";
import ArrowBigDownSvg from "../assets/icons/ArrowBigDown2.svg";
import SectionSevenGraphicSvg from "../assets/icons/composites/section_seven_graphic.svg";
import dropletGif from "../assets/gifs/droplet.gif";
import LineThreeSvg from "../assets/icons/line3.svg";

const SextionSeven: React.FC = () => (
  <div className='mt-[200px] px-[45px] relative z-15'>
    {/* Droplet Animation Background */}
    <div
      style={{
        backgroundImage: `url(${dropletGif})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        position: 'absolute',
        width: '489px',
        height: '489px',
        top: '448px',
        left: '50%',
        opacity: 1,
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
      }}
    />
    {/* Content with higher z-index */}
    <div className='flex flex-col w-full relative z-15'>
      <div className='flex flex-col justify-start items-start w-full'>
        <div className='flex items-start justify-between w-full'>
          <div className='flex items-center justify-start gap-6'>
            <img src={ArrowBigDownSvg} alt="Arrow Big Down" />
            <div className='text-[59px] font-helvetica uppercase font-light leading-16'>
              DROP A TRACK
            </div>
          </div>
          <div className='text-[13px] font-extralight font-auger opacity-50 text-right'>
            Simplicity and minimalism.<br />Just upload a sound, and Resomix will listen.
          </div>
        </div>
        <div className='text-[59px] font-helvetica uppercase font-light leading-16'>
          AND EXPLORE NEW POSSIBILITIES
        </div>
      </div>
      <div className='flex flex-col justify-start items-start mt-[200px]'>
        <img src={SectionSevenGraphicSvg} alt="Section Seven Graphic" />
        <div className='flex justify-center items-start w-full mt-[60px] gap-[235px] opacity-50'>
          <div className="flex flex-col justify-start items-start">
            <div className="text-[7px] font-extralight font-fira  tracking-[2px]">
              machine_listening...
            </div>
            <div className="text-[7px] font-extralight font-fira  tracking-[2px]">
              resonance_activated();
            </div>
            <div className="text-[7px] font-extralight font-fira  tracking-[2px]">
              waveform::quantized
            </div>
            <div className="w-full my-1">
              <img src={LineThreeSvg} alt="Line Three" />
            </div>
            <div className="text-[7px] font-extralight font-fira  tracking-[2px]">
            loop_density &gt; 97%
            </div>
            <div className="text-[7px] font-extralight font-fira  tracking-[2px]">
              feedback_loop::stable
            </div>
            <div className="text-[7px] font-extralight font-fira  tracking-[2px] leading-8">
              spectral_analysis...
            </div>
          </div>
          <div className="flex flex-col justify-start items-end">
            <div className="text-[7px] font-extralight font-fira  tracking-[2px]">
              AI.sync.beatmap[OK]
            </div>
            <div className="text-[7px] font-extralight font-fira  tracking-[2px] leading-8">
              sound.check: PASS
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default SextionSeven;
