import { createContext } from "react";

const AnimationContext = createContext({
  onAnimationStarted: () => {},
  onAnimationEnded: (translationTransitionStyle?: string) => {},
  onHeightChanged: (height: number) => {},
});

export default AnimationContext;
