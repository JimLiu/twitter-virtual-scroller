import { Tweet } from "@/types";
import { useState, useEffect, useCallback, useRef } from "react";

async function fetchUserTimeline(
  screenName: string,
  maxId?: string
): Promise<{ tweets: Tweet[]; hasMore: boolean }> {
  const res = await fetch(
    `/api/user_timeline/${screenName}${maxId ? `?max_id=${maxId}` : ""}`
  );
  const { tweets, hasMore } = await res.json();
  return { tweets, hasMore };
}

export const useTimeline = (screenName: string) => {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error>();
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const maxIds = useRef(new Set<string>());

  useEffect(() => {
    setError(undefined);
    setHasMore(false);
    setLoading(false);
    setTweets([]);
  }, [screenName]);

  const fetchTweets = useCallback(
    async (maxId?: string) => {
      if (loading) {
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        const { tweets, hasMore } = await fetchUserTimeline(screenName, maxId);
        if (Array.isArray(tweets)) {
          setTweets((prev) => {
            const set = new Set(prev.map((tweet) => tweet.id));
            return [...prev, ...tweets?.filter((tweet) => !set.has(tweet.id))];
          });
          setHasMore(hasMore);
          if (maxId) maxIds.current.add(maxId);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [loading, screenName]
  );

  const fetch = useCallback(async () => {
    fetchTweets();
  }, [fetchTweets]);

  const fetchMore = useCallback(async () => {
    const lastTweet = tweets[tweets.length - 1];
    const maxId = lastTweet?.id;
    if (maxId && maxIds.current.has(maxId)) return;
    fetchTweets(maxId);
  }, [tweets, fetchTweets]);

  return { loading, hasMore, error, tweets, fetch, fetchMore };
};
