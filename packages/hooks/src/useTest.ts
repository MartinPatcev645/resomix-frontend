import { useState } from "react";

export function useTest() {
  const [value, setValue] = useState("Hello from useTest!");
  return { value, setValue };
} 