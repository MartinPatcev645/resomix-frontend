import React from "react";

const SectionFive: React.FC = () => (
  <div className='my-20 flex flex-col'>
    <div className='flex flex-col w-full my-20'>
      <div className='flex w-full justify-end'>
        {/* <RightGraphic2 /> */}
      </div>
      <div className='flex flex-col w-full justify-center'>
        <div className="mx-auto text-center text-white text-4xl font-light font-['Montserrat'] uppercase">
          Resomix is the only platform in the world that<br />focuses on the “soul” of your reference track to<br />find music that matches its mood and spirit.
        </div>
        <div className='mx-auto text-center'>
          Cutting-Edge Innovation
        </div>
      </div>
      <div className='flex w-full justify-start'>
        {/* <LeftGraphic2 /> */}
      </div>
    </div>
    <div className='flex flex-row w-full my-20 justify-between items-center'>
      <div className='flex flex-col'>
        <div className=''>
          INSTANT
        </div>
        <div className='flex items-center'>
          <svg xmlns="http://www.w3.org/2000/svg" width="65" height="66" viewBox="0 0 65 66" fill="none">
            <path d="M64.75 55.2207L54.4248 65.75L0.249997 65.75L0.249998 51.2754L25.5967 51.2754L29.874 55.6377L29.9473 55.7119L44.3809 55.7119L43.9658 55.2871L0.355468 10.6758L10.4717 0.361326L54.2148 44.8223L54.6436 45.2578L54.6436 30.2637L54.5723 30.1904L50.292 25.8262L50.292 0.249999L64.75 0.25L64.75 55.2207Z" stroke="white" stroke-width="0.5" />
          </svg>
          <div className=''>
            CATALOG
          </div>
        </div>
        <div className=''>
          SEARCH
        </div>
      </div>
      <div className='flex flex-col'>
        <div className=''>
          Explore a vast catalog in seconds and discover<br />sonic connections where no one else sees them
        </div>
        <div className=''>
          Whether you're looking for underground gems or timeless hits,<br />
          Resomix can help you create unforgettable sets<br />
          that resonate with people.
        </div>
        <div className='flex items-center'>
          <div className="11 relative bg-white rounded-3xl outline outline-[0.50px] outline-offset-[-0.50px] outline-white overflow-hidden p-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20.2498 12H4.25" stroke="black" stroke-width="0.8" stroke-linecap="square" />
              <path d="M14.5898 17.66C14.5898 14.7503 17.1524 12 20.2499 12" stroke="black" stroke-width="0.8" stroke-linecap="square" />
              <path d="M14.5898 6.33995C14.5898 9.2497 17.1524 12 20.2499 12" stroke="black" stroke-width="0.8" stroke-linecap="square" />
            </svg>
          </div>
          <input type="text" placeholder='Search' className="py-3 bg-white rounded-[30px] outline outline-[0.50px] outline-offset-[-0.50px] outline-white inline-flex justify-center items-center gap-2.5" />
        </div>
        <div className=''>
          {/* This will have the dropdown when user searches and we get search results */}
        </div>
      </div>
    </div>
  </div>
);

export default SectionFive;
