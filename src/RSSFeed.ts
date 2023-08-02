export interface TwentyMinFeed {
  items: RSSFeedArticle[];
  image: Image;
  title: string;
  description: string;
  link: string;
  language: string;
}

export interface RSSFeedArticle {
  title: string;
  link: string;
  pubDate: string;
  enclosure: Enclosure;
  content: string;
  contentSnippet: string;
  guid: string;
  isoDate: string;
}

export interface Enclosure {
  type: string;
  url: string;
}

export interface Image {
  link: string;
  url: string;
  title: string;
  width: string;
  height: string;
}
