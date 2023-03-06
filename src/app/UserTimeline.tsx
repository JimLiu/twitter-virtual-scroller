"use client";

import { useState } from "react";
import { Timeline } from "./timeline/Timeline";

export interface UserTimelineProps {}

export const UserTimeline = (props: UserTimelineProps) => {
  const [screenName, setScreenName] = useState("dotey");

  return (
    <div>
      <div className="flex pb-4 gap-2 items-center">
        <div>Twitter user:</div>
        <div>
          <input
            type="text"
            value={screenName}
            className="form-input rounded"
            onChange={(e) => setScreenName(e.target.value)}
          />
        </div>
      </div>
      <Timeline screenName={screenName} />
    </div>
  );
};
