import React from "react";
import { StaticNoise } from "@resomix/ui";

/**
 * Minimal demo page that simply shows the StaticNoise overlay.
 * The previous testing controls were removed now that the component
 * API is final. Feel free to delete this page entirely if unnecessary.
 */
const TestPage: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-[var(--color-secondary)]">
      <StaticNoise className="pointer-events-none fixed inset-0" fps={20} />
    </div>
  );
};

export default TestPage;
