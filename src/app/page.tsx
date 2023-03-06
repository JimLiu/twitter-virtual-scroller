import { Inter } from "next/font/google";
import { UserTimeline } from "./UserTimeline";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <main className="container mx-auto max-w-lg flex flex-col gap-4">
      <h1 className="text-3xl font-bold text-center my-4">
        Twitter VirtualScroller Demo
      </h1>
      <section>
        <a
          className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
          href="https://github.com/jimliu/twitter-virtual-scroller"
        >
          Source code
        </a>
      </section>
      <section className="p-2">
        <UserTimeline />
      </section>
    </main>
  );
}
