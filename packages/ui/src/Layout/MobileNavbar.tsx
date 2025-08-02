import React from "react";

interface MobileNavbarProps {
  logo?: React.ReactNode;
  menuIcon?: React.ReactNode;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({ logo, menuIcon }) => (
  <nav className='flex justify-between items-center align-center pt-[var(--px-28)] px-[var(--px-15)] z-20 relative'>
    <div className="w-[var(--px-30)]">
    </div>
    <div>
      {logo}
    </div>
    <div>
      {menuIcon}
    </div>
  </nav>
);
