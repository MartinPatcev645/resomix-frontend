import React, { useState} from "react";
import { WaveformLoader } from "@resomix/ui";
// import InputPlayer from "@/components/Playlist/InputPlayer.tsx";

// List of UUIDs to request
const UUIDS: string[] = [
  "67ada10e799206f8d64dae5f",
  "67b01139c0f27a0796ef57c1",
  "67b00d20c0f27a0796eeda87",
  "67afb6f8c0f27a0796e4ca4f",
  "67add2c89387d00fbdc0e3c2",
  "67ade01d9387d00fbdc557f2",
  "67b014f1c0f27a0796efc5d1",
  "67adc0ef799206f8d6543059",
  "67afb899c0f27a0796e4fccc",
  "67aff687c0f27a0796ec8067",
  "67b00165c0f27a0796eda60c",
  "67b1b99bf4110a1ed6747859",
  "67afb6ddc0f27a0796e4c6f3",
  "67add5f99387d00fbdc29c93",
  "67adc16d799206f8d6549738",
  "67ada234799206f8d64e5d8f",
  "67adc158799206f8d65479ee",
  "67b1be57f4110a1ed674f59c",
  "67ade0019387d00fbdc53e14",
  "67add2a09387d00fbdc0ba99",
  "67afea53c0f27a0796eb097f",
  "67addea19387d00fbdc4aa97",
  "67aff07ec0f27a0796ebc86a",
  "67addd089387d00fbdc41321",
  "67afb124c0f27a0796e414f0",
  "67ada36e799206f8d64f219d",
  "67adce9e799206f8d6566158",
  "67ada007799206f8d64ced83",
  "67adcf78799206f8d656cb69",
  "67addcd59387d00fbdc3da0f",
  "67afb98ec0f27a0796e51ab0",
  "67addefd9387d00fbdc4da12",
  "67b1ae42f4110a1ed67348bc",
  "67ada682799206f8d64f61ed",
  "67ada37d799206f8d64f2f7d",
  "67adc133799206f8d6546173",
  "67ad9f34799206f8d64c6072",
  "67add3569387d00fbdc126cf",
  "67b0117fc0f27a0796ef6028",
  "67adc0f6799206f8d6543987",
  "67adbb45799206f8d65298bf",
  "67b1aedff4110a1ed6735936",
  "67ada70f799206f8d64fdd49",
  "67afffa1c0f27a0796ed75dc",
  "67afb898c0f27a0796e4fccb",
  "67adced4799206f8d6568e6b",
  "67ada0a0799206f8d64d52ce",
  "67adcfb3799206f8d656d85a",
  "67afb597c0f27a0796e49f60",
  "67add2e09387d00fbdc0e996",
  "67b1bf26f4110a1ed6750ad0",
];

const TestPage: React.FC = () => {
  const [play, setPlay] = useState(false);

  const getPeaksRich = async () => {
    try {
      // 88741ea8-abe3-4d25-808a-3428e8531b02
      // 71a7fdf0-ac11-4a36-8d68-c13204d7b983
      const url = new URL('https://rmedia.resomix.com/peaks-rich/?uuid=67b026f66fd8f3b791b10662');
      url.searchParams.append('api_key', 'bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ');

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/vnd.apple.mpegurl'
        }
      });
      const data = await response.text();
      console.log('HLS Response:', data);
    } catch (error) {
      console.error('Error fetching HLS:', error);
    }
  };

  const handleHlsRequest = async () => {
    try {
      // 88741ea8-abe3-4d25-808a-3428e8531b02
      // 71a7fdf0-ac11-4a36-8d68-c13204d7b983
      const url = new URL('https://bserver.resomix.com/playlists/similarity-hls/ce0223d0-94c0-4b8a-8f26-c1b7db17a0a6.m3u8');
      url.searchParams.append('api_key', 'bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ');

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/vnd.apple.mpegurl'
        }
      });
      const data = await response.text();
      console.log('HLS Response:', data);
    } catch (error) {
      console.error('Error fetching HLS:', error);
    }
  };

  const handleHlsRequestDummy = async () => {
    try {
      const url = new URL('https://bserver.resomix.com/dummy/dummy-hls/ce0223d0-94c0-4b8a-8f26-c1b7db17a0a6.m3u8');
      url.searchParams.append('api_key', 'bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ');

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/vnd.apple.mpegurl'
        }
      });
      const data = await response.text();
      console.log('HLS Response:', data);
    } catch (error) {
      console.error('Error fetching HLS:', error);
    }
  };

  const handleHlsRequestTwo = async () => {
    try {
      const url = new URL('https://rmedia.resomix.com/signed-audio/hls-m3u8/');
      url.searchParams.append('api_key', 'bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.apple.mpegurl'
        },
        body: JSON.stringify({ uuids: UUIDS })
      });
      const data = await response.text();
      console.log('HLS m3u8 Response:', data);
    } catch (error) {
      console.error('Error fetching HLS m3u8:', error);
    }
  };

  const handleHlsRequestThree = async () => {
    try {
      // 88741ea8-abe3-4d25-808a-3428e8531b02
      // 71a7fdf0-ac11-4a36-8d68-c13204d7b983
      const url = new URL('https://rmedia.resomix.com/signed-audio/segment/?uuid=67ada10e799206f8d64dae5f&seg=0');
      url.searchParams.append('api_key', 'bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ');

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/vnd.apple.mpegurl'
        }
      });
      const data = await response.text();
      console.log('HLS Response:', data);
    } catch (error) {
      console.error('Error fetching HLS:', error);
    }
  };

  const handleHlsRequestFour = async () => {
    try {
      // 88741ea8-abe3-4d25-808a-3428e8531b02
      // 71a7fdf0-ac11-4a36-8d68-c13204d7b983
      const url = new URL('https://rmedia.resomix.com/signed-audio/segment/?uuid=silent_1984&seg=0');
      url.searchParams.append('api_key', 'bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ');

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/vnd.apple.mpegurl'
        }
      });
      const data = await response.text();
      console.log('HLS Response:', data);
    } catch (error) {
      console.error('Error fetching HLS:', error);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-[var(--color-primary-background)] text-[var(--color-primary)] flex flex-col gap-[var(--px-40)] justify-start items-start p-[var(--px-40)]">
      <div className="w-full h-full gap-[var(--px-20)] flex flex-col">
        <div className="max-w-[var(--px-250)] lg:max-w-[var(--px-500)] h-[var(--px-50)] overflow-y-hidden bg-[var(--color-secondary)]">
          {/* <InputPlayer
            trackId="1a9983daf38caac5a8e8adaf"
            totalDuration={482}
          /> */}
        </div>
        <div className="w-[var(--px-400)] h-[var(--px-70)] bg-transparent">
          {/* Display the WaveformLoader Animation here */}
          <WaveformLoader />
        </div>
        {/* Display a button saying play, that changes its value to pause based on state */}
        <button className="w-[var(--px-100)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer" onClick={() => setPlay(!play)}>
          {play ? "Pause" : "Play"}
        </button>
        {/* Button to make HLS request */}
        <button
          className="w-[var(--px-150)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer"
          onClick={getPeaksRich}
        >
          Get Rich Peaks
        </button>
        <button
          className="w-[var(--px-150)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer"
          onClick={handleHlsRequest}
        >
          Fetch HLS
        </button>
        <button
          className="w-[var(--px-150)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer"
          onClick={handleHlsRequestDummy}
        >
          Fetch HLS Dummy
        </button>
        <button
          className="w-[var(--px-150)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer"
          onClick={handleHlsRequestTwo}
        >
          Fetch HLS MEDIA
        </button>
        <button
          className="w-[var(--px-150)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer"
          onClick={handleHlsRequestThree}
        >
          Fetch Segment
        </button>
        <button
          className="w-[var(--px-150)] h-[var(--px-50)] bg-[var(--color-secondary)] text-[var(--color-primary)] p-2 rounded-md cursor-pointer"
          onClick={handleHlsRequestFour}
        >
          Fetch Silent Segment
        </button>
      </div>
    </div>
  );
};

export default TestPage;
