import { createContext, useContext } from 'react';
import type { Engine } from '../lib/useEngine';

export const EngineCtx = createContext<Engine | null>(null);
export function useEng(): Engine {
  const e = useContext(EngineCtx);
  if (!e) throw new Error('Engine not ready');
  return e;
}
