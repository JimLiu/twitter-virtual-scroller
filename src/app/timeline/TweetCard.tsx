/* eslint-disable @next/next/no-img-element */
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";

import type { Tweet } from "@/types";
import { Avatar } from "./Avatar";

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo("en-US");

type TweetProps = {
  tweet: Tweet;
};

export const TweetCard: React.FC<TweetProps> = ({ tweet }) => {
  return (
    <div className="pb-4">
      <div className="flex gap-4">
        <div className="flex w-12">
          <Avatar user={tweet.user} />
        </div>
        <div className="flex flex-col gap-2 flex-1 overflow-hidden">
          <div className="w-full">
            <div className="flex justify-between ">
              <h4 className="text-lg font-semibold flex gap-2 justify-center items-baseline">
                <span>{tweet.user.name}</span>
                <span>@{tweet.user.screen_name}</span>
              </h4>
              <div className="text-base">
                {timeAgo.format(new Date(tweet.created_at), "twitter")}
              </div>
            </div>
          </div>
          <div>{tweet.text}</div>
        </div>
      </div>
    </div>
  );
};
