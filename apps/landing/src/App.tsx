import { Navbar } from "@resomix/ui";
import { HeroSection, SectionOne } from "./sections/index.js";
import { LinkButton } from "@resomix/ui";

function App() {

  return (
    <div>
      <Navbar />
      <HeroSection />
      <SectionOne />
      <LinkButton />
    </div>
  );
}

export default App;
