import React from "react";
// import ArrowBigDownSvg from "@/assets/icons/arrow_big_down_stroke.svg"
// import AboutSeparatorLineSvg from "@/assets/icons/about_section_one_line.svg"
// import AboutSeparatorLineTwo from "@/assets/icons/about_section_one_line_2.svg"
// import AnalysisSvg from "@/assets/icons/analysis.svg"
// import MatchesSvg from "@/assets/icons/matches.svg"
// import CraftSvg from "@/assets/icons/craft.svg"

// import GradientThree from "@/assets/images/gradient 3.png"
// import GradientFour from "@/assets/images/gradient 4.png"

const AboutThree: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-150)] mt-[var(--px-450)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                {/* Graphics Overlay */}
                {/* <div className="absolute -top-[var(--px-200)] w-[var(--px-520)] left-[var(--px-320)] pointer-events-none z-5">
                    <img src={GradientThree} alt="gradient_three" className="w-full h-auto" />
                </div>
                <div className="absolute top-[var(--px-500)] w-[var(--px-550)] -left-[var(--px-300)] pointer-events-none z-5">
                    <img src={GradientFour} alt="gradient_four" className="w-full h-auto" />
                </div> */}

                {/* Content */}
                Okay
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-60)] w-full z-15">
                Okay
            </div>
        </div>
    );
};

export default AboutThree;
