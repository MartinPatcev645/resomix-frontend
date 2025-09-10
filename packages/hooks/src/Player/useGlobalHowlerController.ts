import { useRef } from 'react';
import {getGlobalHowlerController} from "./useHowlerController";

export function useGlobalHowlerController() {
  const ref = useRef(getGlobalHowlerController());
  return ref.current;
}