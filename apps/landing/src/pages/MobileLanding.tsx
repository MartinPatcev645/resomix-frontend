import { Navbar } from "@resomix/ui";
import logoHeaderSvg from "../assets/icons/logo_header.svg";

export function MobileLanding() {
  return (
    <div className="bg-black min-h-screen">
      {/* Mobile-specific layout */}
      <div className="px-4 py-6">
        <Navbar logo={<img className="w-20 h-4" src={logoHeaderSvg} alt="ResomiX Logo" />} />
        
        {/* Mobile content sections will go here */}
        <div className="mt-8 text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Mobile View</h1>
          <p className="text-gray-300">
            Mobile-specific design will be implemented here
          </p>
        </div>
      </div>
    </div>
  );
}
