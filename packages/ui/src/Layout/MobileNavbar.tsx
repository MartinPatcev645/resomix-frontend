import React from "react";

interface MobileNavbarProps {
  logo?: React.ReactNode;
  menuIcon?: React.ReactNode;
  customClass?: string;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({ logo, menuIcon, customClass }) => (
  // Either use the custom class or use the existing class
  <nav className={`${customClass ? customClass : 'flex justify-between items-center align-center pt-[var(--px-26)] z-50 relative'}`}>
    <div className="w-[var(--px-35)]">
    </div>
    {logo}
    {menuIcon}
  </nav>
);
