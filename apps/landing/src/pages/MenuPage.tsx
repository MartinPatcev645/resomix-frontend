import React from "react";
import { ContourSphere } from "@resomix/ui";

const MenuPage: React.FC = () => (
  <>
    {/* Top white spacer */}
    <div style={{ height: "100vh", background: "#ffffff" }} />

    {/* Middle container: 800 px tall, black background, contains the sphere */}
    <div
      style={{
        height: 1400,
        background: "#000000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ContourSphere localScroll sections={4} size={500} scrollAreaHeight={1400} />
    </div>

    {/* Bottom white spacer */}
    <div style={{ height: "100vh", background: "#ffffff" }} />
  </>
);

export default MenuPage;
