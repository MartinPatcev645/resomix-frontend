import React from "react";
import { StaticNoise } from "@resomix/ui";
// import { Terrain } from "@resomix/ui";

const TestPage: React.FC = () => (
  <div className="w-screen h-screen relative overflow-hidden">
    {/* Background static noise */}
    <StaticNoise color="#323233" zIndex={0} />
    THIS IS THE TEST PAGE

    {/* Terrain overlay at the top of the screen */}
    {/* <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
        opacity: "60%",
      }}
    >
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
    </div> */}
  </div>
);

export default TestPage;
