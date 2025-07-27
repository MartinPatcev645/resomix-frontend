import React from "react";

const SectionFour: React.FC = () => (
  <div className='mt-[350px]'>
    <div className='flex justify-between items-start'>
      <div className='flex flex-col'>
        <div className='flex flex-col'>
          <div className='flex items-center justify-start'>
            <div className=''>
              HOW
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="65" height="65" viewBox="0 0 65 65" fill="none">
              <path d="M65 64.5422H50.2521V39.245L54.6219 34.9619L54.6219 21.4432L10.5147 64.5369L0.00546335 54.236L43.9706 11.0031L29.9055 11.0031L25.5357 15.2862L0 15.2862L0 0.562988L54.4853 0.562988L65 10.8693L65 64.5422Z" fill="white" />
            </svg>
          </div>
          <div className=''>
            RESOMIX<br />WORKS
          </div>
        </div>
        <div className=''>
          <svg xmlns="http://www.w3.org/2000/svg" width="416" height="230" viewBox="0 0 416 230" fill="none">
            <path d="M179.5 47H1V229.5H415V1H236.5L179.5 47Z" stroke="white" stroke-width="0.5" stroke-dasharray="1 1" />
          </svg>
        </div>
      </div>
      <div className='flex flex-col'>
        <div className='flex flex-col items-start'>
          <div className='flex items-center justify-start gap-5'>
            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none">
              <path d="M28 55C42.9117 55 55 42.9117 55 28C55 13.0883 42.9117 1 28 1C13.0883 1 1 13.0883 1 28C1 42.9117 13.0883 55 28 55Z" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M28.0002 47.472C38.7542 47.472 47.472 38.7542 47.472 28.0002C47.472 17.2462 38.7542 8.52832 28.0002 8.52832C17.2462 8.52832 8.52832 17.2462 8.52832 28.0002C8.52832 38.7542 17.2462 47.472 28.0002 47.472Z" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M27.9999 39.6545C34.4363 39.6545 39.654 34.4368 39.654 28.0003C39.654 21.5639 34.4363 16.3462 27.9999 16.3462C21.5634 16.3462 16.3457 21.5639 16.3457 28.0003C16.3457 34.4368 21.5634 39.6545 27.9999 39.6545Z" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M27.9997 31.9085C30.1585 31.9085 31.9085 30.1585 31.9085 27.9997C31.9085 25.8409 30.1585 24.0908 27.9997 24.0908C25.8409 24.0908 24.0908 25.8409 24.0908 27.9997C24.0908 30.1585 25.8409 31.9085 27.9997 31.9085Z" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
            </svg>
            <div className=''>
              1 — Upload Your Reference Track
            </div>
          </div>
          <div className=''>
            You can upload any audio file: a released or unreleased track, a sketch from your archive, or a short clip.Metadata is not important; Resomix listens to your reference audio and extrapolates its sonic DNA to find a perfect match.
          </div>
        </div>
        <div className=''>
          -------------------------
        </div>
        <div className='flex justify-between items-start'>
          <div className='flex flex-col justify-between gap-6 items-start'>
            <svg xmlns="http://www.w3.org/2000/svg" width="61" height="63" viewBox="0 0 61 63" fill="none">
              <path d="M27.4605 3.81309C49.6097 1.71309 65.0927 24.9994 54.2403 44.566C43.6746 63.6237 15.3823 63.1435 5.77 43.5554C-2.6381 26.4186 8.3505 5.6264 27.4605 3.81309ZM46.083 41.2476C48.0256 39.3984 49.6957 26.9274 51.0147 23.4298C51.6669 21.7025 52.6991 20.5056 53.3443 18.9718C44.9863 2.58032 22.2422 0.229469 10.3217 14.2701C4.02817 21.681 2.04979 32.9479 6.56566 41.6848C8.39351 41.7063 10.8951 27.5868 11.5044 25.4868C12.1997 23.093 13.9846 16.9435 17.5184 19.9895C19.9412 22.0752 21.1526 31.8155 22.0486 35.1626C22.5002 36.854 23.898 43.1397 26.2993 41.3551C28.4855 39.7281 30.4782 25.9813 32.0122 22.3404C34.2128 17.1155 37.2449 18.9503 38.8003 23.4226C40.8791 29.3786 40.7644 36.1445 44.076 41.6203C44.4917 41.8639 45.7246 41.5701 46.0759 41.2332L46.083 41.2476ZM34.4063 20.6203C32.3921 21.7885 30.1413 36.811 28.6217 40.0936C27.6397 42.2151 25.7832 44.3581 23.5969 42.2366C21.1311 39.8428 19.8552 29.6581 18.7585 25.9312C17.9055 23.0284 16.049 17.2875 13.6477 22.9783C10.9023 29.4933 11.6621 37.5063 7.16777 43.2472C15.0239 58.3558 34.9367 62.1329 47.7962 50.6725C53.8532 45.2755 57.3942 36.4957 56.4695 28.368C56.3477 27.3288 54.9858 21.509 54.4338 21.0861C53.5665 20.4196 52.6848 22.5267 52.4554 23.0786C50.8498 27.0134 49.28 40.3373 46.7282 42.4373C45.6386 43.3261 44.1907 43.3476 43.1226 42.4302C40.8504 40.4807 39.596 31.3496 38.7645 28.1602C38.3989 26.7482 36.7789 19.2585 34.4135 20.6346L34.4063 20.6203Z" fill="white" />
            </svg>
            <div className=''>
              2 — Deep Sonic Analysis
            </div>
            <div className=''>
              Here’s when the magic happens.
              Our system performs a full spectral analysis on a granular level, exploring every aspect of your tune: rhythm, harmonic content, energy flow, dynamics, and tonal balance.
            </div>
          </div>
          <div className=''>
            |<br />|<br />|<br />|<br />
          </div>
          <div className='flex flex-col justify-between gap-6 items-start'>
            <svg xmlns="http://www.w3.org/2000/svg" width="54" height="56" viewBox="0 0 54 56" fill="none">
              <path d="M3.74414 14.3198L50.1841 41.6798" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M3.45605 41.104L50.6881 14.896" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M13.3203 4.74414L40.7523 51.3281" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M26.5684 1L27.4324 55" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M0 27.9277H54" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M14.6162 49.8163L39.0242 6.76025" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M38.6637 10.4323C40.3338 10.4323 41.6877 9.07839 41.6877 7.40828C41.6877 5.73817 40.3338 4.38428 38.6637 4.38428C36.9935 4.38428 35.6396 5.73817 35.6396 7.40828C35.6396 9.07839 36.9935 10.4323 38.6637 10.4323Z" fill="white" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
              <path d="M15.3355 51.5436C17.0056 51.5436 18.3595 50.1897 18.3595 48.5196C18.3595 46.8495 17.0056 45.4956 15.3355 45.4956C13.6654 45.4956 12.3115 46.8495 12.3115 48.5196C12.3115 50.1897 13.6654 51.5436 15.3355 51.5436Z" fill="white" stroke="white" stroke-width="1.5" stroke-miterlimit="10" />
            </svg>
            <div className=''>
              3 — Get Perfect Matches
            </div>
            <div className=''>
              Within seconds, you’ll have a carefully crafted selection of tracks that resonate with your reference’s vibe, regardless of genre, release date, or popularity.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default SectionFour;
