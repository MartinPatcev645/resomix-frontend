import React from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { ButtonHeavyRight } from "../Buttons/ButtonHeavyRight";

export const Navbar: React.FC = () => (
  <nav className="">
    <div className="">
    <ButtonSleek />
    </div>
    <div className=""></div>
    <div className="">
      <ButtonHeavyRight />
    </div>
  </nav>
);