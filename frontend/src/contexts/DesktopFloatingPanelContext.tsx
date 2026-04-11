/**
 * @file DesktopFloatingPanelContext.tsx
 * @description Coordinates portalled desktop right-side floating panels with the root layout
 * @app SHARED - Used by the root layout and right floating side panels
 */

import { createContext, useContext, useMemo, useState } from 'react';

export interface DesktopFloatingPanelContextValue {
  rightPanelPortalElement: HTMLDivElement | null;
  setRightPanelPortalElement: (element: HTMLDivElement | null) => void;
  rightPanelReserve: number;
  setRightPanelReserve: (reserve: number) => void;
}

const DesktopFloatingPanelContext = createContext<DesktopFloatingPanelContextValue>({
  rightPanelPortalElement: null,
  setRightPanelPortalElement: () => {},
  rightPanelReserve: 0,
  setRightPanelReserve: () => {},
});

export const useDesktopFloatingPanelContext = () => useContext(DesktopFloatingPanelContext);

export function useDesktopFloatingPanelProvider(): DesktopFloatingPanelContextValue {
  const [rightPanelPortalElement, setRightPanelPortalElement] = useState<HTMLDivElement | null>(null);
  const [rightPanelReserve, setRightPanelReserve] = useState(0);

  return useMemo<DesktopFloatingPanelContextValue>(() => ({
    rightPanelPortalElement,
    setRightPanelPortalElement,
    rightPanelReserve,
    setRightPanelReserve,
  }), [rightPanelPortalElement, rightPanelReserve]);
}

export { DesktopFloatingPanelContext };