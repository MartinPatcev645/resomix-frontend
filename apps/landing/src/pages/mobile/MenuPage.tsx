import React from "react";
import { StaticNoise, Terrain } from "@resomix/ui";

const MenuPage: React.FC = () => (
  <div className="w-screen h-screen relative overflow-hidden">
    {/* Background static noise */}
    <StaticNoise color="#323233" zIndex={0} />
    <div className="w-screen h-screen relative overflow-hidden">
      OKAY
    </div>
  </div>
);

export default MenuPage;
