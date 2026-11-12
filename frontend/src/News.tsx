import { useState } from "react";
import { Icon } from "./components.tsx";
import { newsDate, newsEventTitle, newsFeed, type NewsPost } from "./news.ts";

/** Posts shown before "Show more news". */
const FIRST = 4;

function NewsCard({
  post,
  onOpen,
}: {
  post: NewsPost;
  onOpen: (post: NewsPost) => void;
}) {
  const eventTitle = newsEventTitle(post);
  return (
    <li>
      <button
        className="news-card"
        onClick={() => onOpen(post)}
        aria-label={`${post.title}. ${eventTitle ? `Open event details for ${eventTitle}` : "Open community"}`}
      >
        <span className={`news-art poster ${post.tone}`} aria-hidden="true">
          <small>{post.org}</small>
          <b>
            {post.poster[0]}
            <br />
            {post.poster[1]}
          </b>
        </span>
        <span className="news-body">
          <span className="news-title">{post.title}</span>
          <span className="news-date">
            {post.updated ? "Updated " : ""}
            {newsDate(post.date)}
          </span>
          <span className="news-by">
            Posted by {post.author} for {post.org}
          </span>
          <span className="news-summary">{post.summary}</span>
          <span className="news-link">
            {eventTitle ? "View event" : "Open community"} <Icon name="arrow" />
          </span>
        </span>
      </button>
    </li>
  );
}

/** My Dashboard "News": fictional posts from demo communities and schools. */
export function News({
  onEvent,
  onCommunity,
}: {
  onEvent: (id: string) => void;
  onCommunity: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const feed = newsFeed();
  const shown = all ? feed : feed.slice(0, FIRST);
  const open = (post: NewsPost) =>
    post.eventId ? onEvent(post.eventId) : onCommunity(post.communityId!);
  return (
    <section className="panel news" aria-labelledby="news-title">
      <div className="section-bar">
        <h2 id="news-title">News</h2>
        <span className="date">Fictional campus news</span>
      </div>
      <ul className="news-list">
        {shown.map((post) => (
          <NewsCard key={post.id} post={post} onOpen={open} />
        ))}
      </ul>
      {feed.length > FIRST ? (
        <button className="text-btn news-more" onClick={() => setAll(!all)}>
          {all ? "Show less" : `Show more news (${feed.length - FIRST})`}
        </button>
      ) : null}
    </section>
  );
}
