import React from "react";
// import { Terrain } from "@resomix/ui";
import { StaticNoise } from "@resomix/ui";

const MenuPage: React.FC = () => (
  <div className="w-screen h-screen bg-black">
    <div className="w-screen h-[var(--px-489)] my-auto opacity-40">
      {/* <Terrain
        speed={1.2}
        segments={324}
        perlinPasses={1}
        elevation={1}
        noiseRange={2.14}
        sombreroAmplitude={0.6}
        sombreroFrequency={10}
        wireframe={true}
        wireframeColor="#FFFFFF"
        floorVisible={false}
      /> */}
      <StaticNoise
        fps={30}
        canvasBg="#323233"
        pageBg=""
      />
    </div>
  </div>
);

export default MenuPage;
