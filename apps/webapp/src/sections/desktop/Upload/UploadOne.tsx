import React, { useState } from "react";
import InfoSvg from "@/assets/icons/info.svg";
import { SearchComponent, UploadComponent, PopularComponent } from "@/components/index.ts";

const UploadOne: React.FC = () => {
    const [activeComponent, setActiveComponent] = useState<'search' | 'upload'>('search');

    const handleSearchClick = () => {
        setActiveComponent('search');
    };

    const handleUploadClick = () => {
        setActiveComponent('upload');
    };

    return (
        <div className="flex flex-col mx-auto items-center justify-center mt-[var(--px-100)]">
            <div className="w-[var(--px-880)] h-[var(--px-61)] bg-[var(--color-primary-background)] border border-dotted border-slate-200 flex justify-between px-[var(--px-12)] py-[var(--px-14)]">
                <div className="">
                    <div className="text-[length:var(--px-11)] font-light font-helvetica uppercase">
                        Set Your Depth
                    </div>
                    <div className="text-[length:var(--px-9)] font-fira font-light opacity-70">
                        Choose how many similar tracks Resomix will recommend.
                    </div>
                </div>
                <div className="flex items-center gap-[var(--px-6)]">
                    <div className="text-[length:var(--px-9)] font-fira font-light">
                        Results Count
                    </div>
                    <div className="hover:cursor-pointer">
                        <img src={InfoSvg} alt="Info" className="w-[var(--px-10)] h-[var(--px-10)]" />
                    </div>
                    {/* Dropdown menu following same style */}
                    <div className="">
                        <select className="w-[var(--px-97)] h-[var(--px-26)] bg-transparent border border-dotted border-slate-200 text-[length:var(--px-11)] font-fira font-extralight text-center text-[var(--color-primary)]">
                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="10">10 tracks</option>
                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="20" selected>20 tracks</option>
                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="50">50 tracks</option>
                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="100">100 tracks</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="flex w-[var(--px-880)] h-auto justify-between mt-[var(--px-20)]">
                <div className="flex-1/2 mr-[var(--px-15)]">
                    {activeComponent === 'search' ? (
                        <SearchComponent 
                            onUploadClick={handleUploadClick}
                        />
                    ) : (
                        <UploadComponent 
                            onSearchClick={handleSearchClick}
                        />
                    )}
                </div>
                <div className="flex-1/2 ml-[var(--px-15)]">
                    <PopularComponent />
                </div>
            </div>
        </div>
    );
};

export default UploadOne;
