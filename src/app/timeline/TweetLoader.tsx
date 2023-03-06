import { useEffect } from "react";
import { useTimelineContext } from "./TimelineContext";

export interface TweetLoaderProps {}

export const TweetLoader: React.FC<TweetLoaderProps> = () => {
  const { loading, hasMore, error, fetchMore } = useTimelineContext();
  const renderContent = () => {
    if (loading) {
      return <div>Loading</div>;
    }
    if (error) {
      return (
        <button
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => fetchMore()}
        >
          Something went wrong, try again
        </button>
      );
    }
    if (!hasMore) {
      return <div>All tweets had been loaded</div>;
    }

    return (
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={() => fetchMore()}
      >
        Load more
      </button>
    );
  };

  useEffect(() => {
    if (!loading && hasMore && !error) {
      fetchMore();
    }
  }, [loading, hasMore, fetchMore, error]);

  return (
    <div className="flex justify-center items-center">{renderContent()}</div>
  );
};
