import React from "react";
import SectionFiveGraphicLeft from "@/assets/icons/composites/mobile/section_five_graphic_left.svg";
import SectionFiveGraphicRight from "@/assets/icons/composites/mobile/section_five_graphic_right.svg";
import ArrowBigDownSvg from "@/assets/icons/arrow_down_right.svg";
import { SearchInput, SearchDropdown } from "@resomix/ui";
import { useSearch } from "@resomix/hooks";
import { BASE_BETA_URL } from "@resomix/config";

const HomeFive: React.FC = () => {
  const { query, results, isLoading, handleQueryChange } = useSearch();
  const dropdownResults = React.useMemo(() => results.map((r) => ({ ...r, id: r.id })), [results]);

  return (
    <div className='mt-[var(--px-120)] flex flex-col relative z-15'>
      {/* Section Five A */}
      <div className='flex flex-col w-full my-[var(--px-80)]'>
        <div className='flex w-full justify-end relative'>
          <div className="absolute top-1/3 right-0 transform text-[length:var(--px-14)] font-extralight font-auger text-right z-20 mr-[var(--px-35)] -mt-[var(--px-14)] leading-[var(--px-16)]">
            Deep sonic analysis, pure<br />and simple, unaffected by<br />metadata or trends.
          </div>
          <img src={SectionFiveGraphicRight} alt="Section Five Graphic Right" className="w-[var(--px-280)] h-[var(--px-100)]" />
        </div>
        <div className='flex flex-col w-full justify-center'>
          <div className="mx-auto text-center text-[length:var(--px-20)] font-light leading-[var(--px-24)] mt-[var(--px-80)] font-helvetica uppercase">
            Resomix is the only platform in<br />the world that focuses on the<br />“soul” of your reference track<br />to find music that matches its<br />mood and spirit.
          </div>
          <div className='mx-auto text-center text-[length:var(--px-14)] mt-[var(--px-14)] font-auger tracking-wide'>
            Cutting-Edge Innovation
          </div>
        </div>
        <div className='flex w-full justify-start relative mt-[var(--px-80)]'>
          <div className="absolute top-1/3 left-0 text-left text-[length:var(--px-14)] font-extralight font-auger z-20 ml-[var(--px-32)] -mt-[var(--px-2)] leading-[var(--px-16)]">
            A human approach<br />to modern technology.
          </div>
          <img src={SectionFiveGraphicLeft} alt="Section Five Graphic Left" className="w-[var(--px-280)] h-[var(--px-100)]" />
        </div>
      </div>

      {/* Section Five B */}
      <div className='mt-[var(--px-150)] flex flex-col w-full mb-[var(--px-80)] justify-between items-start'>
        <div className='flex flex-col text-[length:var(--px-43)] font-bold leading-[var(--px-43)] font-helvetica uppercase'>
          <div className=''>
            INSTANT
          </div>
          <div className='flex items-center gap-[var(--px-12)]'>
            <img src={ArrowBigDownSvg} alt="Arrow Big Down" className="w-[var(--px-31)] h-[var(--px-31)]" />
            <div className=''>
              CATALOG
            </div>
          </div>
          <div className=''>
            SEARCH
          </div>
        </div>
        <div className='flex flex-col'>
          <div className='text-[length:var(--px-21)] font-helvetica font-semibold uppercase leading-[var(--px-24)] text-left my-[var(--px-40)] font-bold'>
            Explore a vast music<br />catalog in seconds and<br />discover connections<br />where no one else sees them
          </div>
          <div className='mt-[var(--px-60)] relative w-full'>
            {/** Search bar & dropdown */}
            <SearchInput value={query} onChange={handleQueryChange} width="w-[var(--px-310)]" />
            <SearchDropdown show={query.length > 0} results={dropdownResults} width="w-[var(--px-310)]" isLoading={isLoading} truncateLength={20} isMobile={true} onSelect={(result) => {
              window.location.href = `${BASE_BETA_URL}/?id=${result.id}`;
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeFive;
