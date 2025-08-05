import React from "react";

interface MobileNavbarProps {
  logo?: React.ReactNode;
  menuIcon?: React.ReactNode;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({ logo, menuIcon }) => (
  <nav className='flex justify-between items-center align-center pt-[var(--px-39)] px-[var(--px-29)] z-50 relative'>
    <div className="w-[var(--px-35)]">
    </div>
    {logo}
    {menuIcon}
  </nav>
);
