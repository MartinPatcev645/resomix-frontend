import React from "react";

export const Navbar: React.FC = () => (
  <nav className="bg-brand text-white px-4 py-2 flex items-center justify-between">
    <span className="font-bold text-lg">Resomix</span>
    <div className="space-x-4">
      <a href="#" className="hover:underline">Home</a>
      <a href="#" className="hover:underline">About</a>
      <a href="#" className="hover:underline">Contact</a>
    </div>
  </nav>
); 