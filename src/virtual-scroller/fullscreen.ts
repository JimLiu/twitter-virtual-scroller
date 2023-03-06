const fullscreenElementNames = [
  "fullscreenElement",
  "webkitFullscreenElement",
  "webkitCurrentFullScreenElement",
  "mozFullScreenElement",
  "msFullscreenElement",
];

type EnterFullscreenListener = (element: HTMLElement) => void;
type ExitFullscreenListener = () => void;

const enterFullscreenListeners = new Set<EnterFullscreenListener>();
const exitFullscreenListeners = new Set<ExitFullscreenListener>();

[
  "webkitfullscreenchange",
  "mozfullscreenchange",
  "fullscreenchange",
  "msfullscreenchange",
].forEach((eventName) => {
  if (typeof document === "undefined") {
    return;
  }

  document.addEventListener(eventName, () => {
    const fullscreenElement = fullscreenElementNames
      .map((elementName) => (document as any)[elementName])
      .filter(Boolean)[0];

    if (fullscreenElement) {
      enterFullscreenListeners.forEach((listener) =>
        listener(fullscreenElement)
      );
    } else {
      exitFullscreenListeners.forEach((listener) => listener());
    }
  });
});

export function onEnterFullscreen(listener: EnterFullscreenListener) {
  enterFullscreenListeners.add(listener);
  return () => enterFullscreenListeners.delete(listener);
}

export function onExitFullscreen(listener: ExitFullscreenListener) {
  exitFullscreenListeners.add(listener);
  return () => exitFullscreenListeners.delete(listener);
}
