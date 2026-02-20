import React from "react";
import SectionFiveGraphicLeft from "@/assets/icons/composites/section_five_graphic_left.svg";
import SectionFiveGraphicRight from "@/assets/icons/composites/section_five_graphic_right.svg";
import ArrowBigDownSvg from "@/assets/icons/arrow_big_down_stroke.svg";
// import SoulOfReference from "@/assets/icons/hero/section_five_soul_of_reference.svg";
import { SearchInput, SearchDropdown } from "@resomix/ui";
import { useSearch } from "@resomix/hooks";
import { BASE_BETA_URL } from "@resomix/config";

const HomeFive: React.FC = () => {
  const { query, results, isLoading, handleQueryChange } = useSearch();
  const dropdownResults = React.useMemo(() => results.map((r) => ({ ...r, id: r.id })), [results]);

  return (
    <div className='mt-[var(--px-200)] flex flex-col relative z-30'>
      {/* Section Five A */}
      <div className='flex flex-col w-full my-[var(--px-80)]'>
        <div className='flex w-full justify-end relative'>
          <div className="absolute top-1/3 right-0 transform text-[length:var(--px-13)] font-light font-auger text-right z-20 mr-[var(--px-60)] -mt-[var(--px-4)] leading-[var(--px-16)] opacity-70">
            Built on established signal processing, not<br />black-box AI. Deterministic. Reproducible.<br />Transparent.
          </div>
          <img src={SectionFiveGraphicRight} aria-hidden="true" loading="lazy" draggable={false} alt="Section Five Graphic Right" className="w-[var(--px-444)] h-[var(--px-154)]" />
        </div>
        <div className='flex flex-col w-full justify-center'>
          <div className="relative z-20 mx-auto text-center text-[length:var(--px-25-19)] font-extralight leading-[var(--px-34)] mt-[var(--px-24)] opacity-90 font-helvetica uppercase">
            Resomix reads the texture of your reference track<br />- rhythm, harmonic content, energy, timbre <span className="font-medium text-white"></span>
          </div>
          {/* <img src={SoulOfReference} aria-hidden="true" loading="lazy" draggable={false} alt="Soul Of Reference" className="absolute z-5 top-[25.8%] left-[50%] transform -translate-x-1/2 w-[var(--px-775)] h-[var(--px-70)]" /> */}
          <div className='mx-auto text-center text-[length:var(--px-13)] font-extralight mt-[var(--px-12)] opacity-60 font-auger'>
            70+ audio features analyzed per track.<br />Zero influence from popularity metrics.
          </div>
        </div>
        <div className='flex w-full justify-start relative'>
          <div className="absolute top-1/3 left-0 text-left text-[length:var(--px-13)] font-auger font-light z-20 ml-[var(--px-32)] -mt-[var(--px-4)] leading-[var(--px-16)] opacity-70">
            Pure Sonic Analysis.<br />Unaffected by metadata,<br />charts, or trends.
          </div>
          <img src={SectionFiveGraphicLeft} aria-hidden="true" loading="lazy" draggable={false} alt="Section Five Graphic Left" className="w-[var(--px-276)] h-[var(--px-83)]" />
        </div>
      </div>

      {/* Section Five B */}
      <div className='mt-[var(--px-300)] pr-[var(--px-2)] flex flex-row w-full mb-[var(--px-80)] justify-between items-center'>
        <div className='flex flex-col text-[length:var(--px-66)] font-bold leading-[var(--px-64)] font-helvetica uppercase'>
          <div className=''>
            INSTANT
          </div>
          <div className='flex items-center'>
            <img src={ArrowBigDownSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Arrow Big Down" className="w-[var(--px-49)] h-[var(--px-49)]" />
            <div className=''>
              CATALOG
            </div>
          </div>
          <div className=''>
            SEARCH
          </div>
        </div>
        <div className='flex flex-col'>
          <div className='text-[length:var(--px-22)] font-fira font-semibold uppercase leading-7 text-right'>
            Search millions of tracks instantly.<br />Find connections no one else can hear.
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger text-right opacity-60 leading-[var(--px-16)] my-[var(--px-12)]'>
            From deep cuts to overlooked catalog gems<br />Surface the tracks that belong in your next set.
          </div>
          <div className='mt-[var(--px-16)] relative w-[var(--px-588)] self-end'>
            {/** Search bar & dropdown */}
            <SearchInput value={query} onChange={handleQueryChange} placeholder="Search by artist, title, or mood ..." />
            <SearchDropdown show={query.length > 0} results={dropdownResults} truncateLength={22} isLoading={isLoading} onSelect={(result) => {
              window.location.href = `${BASE_BETA_URL}/?id=${result.id}`;
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeFive;
