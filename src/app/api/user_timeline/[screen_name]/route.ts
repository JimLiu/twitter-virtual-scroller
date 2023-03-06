import { NextResponse } from "next/server";

import { type NextRequest } from "next/server";

const count = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: { screen_name: string } }
) {
  const { screen_name } = params;
  const maxId = new URL(request.url).searchParams.get("max_id");

  const req = await fetch(
    `https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${screen_name}&count=${count}${
      maxId ? `&max_id=${maxId}` : ""
    }`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      },
    }
  );
  const userTimeline = await req.json();

  const tweets = userTimeline ?? [];
  const hasMore = tweets.length > 1;

  return NextResponse.json({
    tweets,
    hasMore,
  });
}
