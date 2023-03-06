import { Tweet } from "@/types";
import { createContext, useContext } from "react";

interface TimelineContextType {
  loading: boolean;
  hasMore: boolean;
  error?: Error;
  tweets: Tweet[];
  fetch: () => Promise<void>;
  fetchMore: () => Promise<void>;
}

export const TimelineContext = createContext<TimelineContextType>({
  loading: false,
  hasMore: false,
  tweets: [],
  fetch: async () => {},
  fetchMore: async () => {},
});

export const useTimelineContext = () => useContext(TimelineContext);
