let activeScribbleFullscreenBlockId: string | null = null;

const fullscreenListeners = new Set<() => void>();

function emitFullscreenChange() {
  fullscreenListeners.forEach((listener) => listener());
}

export function getActiveScribbleFullscreenBlockId(): string | null {
  return activeScribbleFullscreenBlockId;
}

export function subscribeScribbleFullscreen(listener: () => void): () => void {
  fullscreenListeners.add(listener);

  return () => {
    fullscreenListeners.delete(listener);
  };
}

export function openScribbleFullscreen(blockId: string) {
  if (activeScribbleFullscreenBlockId === blockId) {
    return;
  }

  activeScribbleFullscreenBlockId = blockId;
  emitFullscreenChange();
}

export function closeScribbleFullscreen(blockId?: string) {
  if (blockId && activeScribbleFullscreenBlockId !== blockId) {
    return;
  }

  if (activeScribbleFullscreenBlockId == null) {
    return;
  }

  activeScribbleFullscreenBlockId = null;
  emitFullscreenChange();
}