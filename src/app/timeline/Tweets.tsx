"use client";
import type { Tweet } from "@/types";

import { VirtualScroller } from "@/virtual-scroller/VirtualScroller";
import { IViewport, WindowViewport } from "@/virtual-scroller/Viewport";
import { useEffect, useRef, useState } from "react";
import { TweetCard } from "./TweetCard";
import { TweetLoader } from "./TweetLoader";

export type TweetsProps = {
  screenName: string;
  tweets: Tweet[];
};

export const Tweets: React.FC<TweetsProps> = ({ tweets, screenName }) => {
  const [viewport, setViewport] = useState<IViewport | null>(null);

  useEffect(() => {
    setViewport(WindowViewport.root());
  }, []);

  if (!viewport) {
    return null;
  }

  const items = [...tweets, null];
  return (
    <>
      <VirtualScroller
        cacheKey={`user-timeline-${screenName}`}
        items={items}
        viewport={viewport}
        identityFunction={(tweet) => tweet?.id ?? "loader"}
        noItemsRenderer={() => <div>empty</div>}
        renderer={(item) =>
          item ? <TweetCard tweet={item} /> : <TweetLoader />
        }
      />
    </>
  );
};
