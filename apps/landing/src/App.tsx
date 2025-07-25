import { useEffect } from "react";
import { Navbar } from "@resomix/ui";
import { ButtonHeavyLeft } from "@resomix/ui";
import { useTest } from "@resomix/hooks";
import { fetchDummyData } from "@resomix/api-client";

function App() {
  const { value, setValue } = useTest();

  useEffect(() => {
    fetchDummyData().then((data: { message: string }) => {
      setValue(data.message);
    });
  }, [setValue]);

  return (
    <div>
      <Navbar />
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{value}</h1>
        <ButtonHeavyLeft />
        <button
          className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded"
          onClick={() => setValue("Button Clicked!")}
        >
          Change Value
        </button>
      </div>
    </div>
  );
}

export default App;
