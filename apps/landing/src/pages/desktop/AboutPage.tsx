import { AboutHero, AboutOne, AboutTwo, AboutThree, AboutFour } from "@/sections/desktop/index.ts";

export function AboutPage() {
  return (
    <div className="overflow-x-hidden">
      <AboutHero />
      <AboutOne />
      <AboutTwo />
      <AboutThree />
      <AboutFour />
    </div>
  );
}
