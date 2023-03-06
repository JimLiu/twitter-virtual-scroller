"use client";
import type { Tweet } from "@/types";

import { useEffect, useState } from "react";
import { TimelineContext } from "./TimelineContext";
import { Tweets } from "./Tweets";
import { useTimeline } from "./useTimeline";

type TimelineProps = {
  screenName: string;
};

export const Timeline: React.FC<TimelineProps> = ({ screenName }) => {
  const { tweets, loading, hasMore, error, fetch, fetchMore } =
    useTimeline(screenName);

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenName]);

  return (
    <TimelineContext.Provider
      value={{ tweets, loading, hasMore, error, fetch, fetchMore }}
    >
      <Tweets tweets={tweets} screenName={screenName} />
    </TimelineContext.Provider>
  );
};
