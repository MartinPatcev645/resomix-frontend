import { FractalOrb } from "@resomix/ui";

export function Menu() {
  return (
    <div className="bg-black min-h-screen">
      <h1 className="text-4xl font-bold mb-4 text-white">Menu Page</h1>

      {/* full-viewport fractal orb */}
      <div className="relative w-[600px] h-[600px]">
        <FractalOrb />
      </div>
    </div>
  );
}
