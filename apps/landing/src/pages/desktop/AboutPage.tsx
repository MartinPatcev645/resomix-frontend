import { AboutHero, AboutOne, AboutTwo, AboutThree, AboutFour, AboutFive } from "@/sections/desktop/index.ts";

export function AboutPage() {
  return (
    <div className="overflow-hidden">
      <AboutHero />
      <AboutOne />
      <AboutTwo />
      <AboutThree />
      <AboutFour />
      <AboutFive />
    </div>
  );
}
