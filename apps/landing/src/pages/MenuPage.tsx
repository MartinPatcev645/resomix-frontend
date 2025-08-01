import React from "react";
import { Terrain } from "@resomix/ui";

const MenuPage: React.FC = () => (
  <div className="w-screen h-[200px] bg-black">
    <Terrain
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
    />
  </div>
);

export default MenuPage;
