import puppeteer, { EvaluateFunc, Page } from "puppeteer";
import Parser from "rss-parser";
import { TwentyMinFeed } from "./RSSFeed.js";
import { db } from "./db.js";
import { seed } from "./seed.js";
import { readFile, writeFile } from "fs/promises";
import { autoScroll } from "./helpers.js";
import { Comment, Article } from "./article.js";

/////////////////////////////////////////////////////////////////////////////////////

const parseCommentFn = await readFile("./parseComment.js", "utf-8");

async function getCommentsFromPage(page: Page) {
  return await page.evaluate(async (parseCommentFn: string) => {
    const script = document.createElement("script");
    const content = document.createTextNode(parseCommentFn);
    script.appendChild(content);
    document.body.appendChild(script);

    const comments = Array.from(
      document.querySelectorAll("#commentSection > div > article")
    );
    const res = await Promise.all(
      // @ts-ignore
      comments.map(async (comment) => await parseComment(comment))
    );
    return res as Comment[];
  }, parseCommentFn);
}

/////////////////////////////////////////////////////////////////////////////////////

async function navigateToCommentPage(page: Page) {
  const [allekommentare] = await page.$x(
    "//a[contains(., 'Alle Kommentare anzeigen')]"
  );
  if (!allekommentare) {
    page.close();
    return false;
  }

  const href = await allekommentare.evaluate((el) =>
    (el as any).getAttribute("href")
  );
  await page.goto(`https://20min.ch${href}`);
  return true;
}

/////////////////////////////////////////////////////////////////////////////////////

async function insertComment(
  articleId: number,
  parentId: number = null,
  comment: Comment
) {
  const newComment = await db.run(
    "INSERT INTO comments (author, createdAt, content, reactions_quatsch, reactions_unnoetig, reactions_genau, reactions_love_it, reactions_smart, reactions_so_nicht, articleId, parentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      comment.author,
      comment.createdAt,
      comment.content,
      comment.reactions_quatsch,
      comment.reactions_unnoetig,
      comment.reactions_genau,
      comment.reactions_love_it,
      comment.reactions_smart,
      comment.reactions_so_nicht,
      articleId,
      parentId,
    ]
  );

  if (comment.subComments) {
    await Promise.all(
      comment.subComments.map(async (subComment) => {
        await insertComment(articleId, newComment.lastID, subComment);
      })
    );
  }
}

/////////////////////////////////////////////////////////////////////////////////////

await seed();

const parser = new Parser<TwentyMinFeed>();

const result = await parser.parseURL(
  "https://partner-feeds.beta.20min.ch/rss/20minuten"
);

export const articleExists = async (guid: string) => {
  const row = await db.get("SELECT rowid AS id FROM articles WHERE guid = ?", [
    guid,
  ]);

  return !!row;
};

for (const item of result.items) {
  const exists = await articleExists(item.guid);
  if (!exists) {
    await db.run(
      "INSERT INTO articles (title, link, pubDate, content, contentSnippet, guid, isoDate) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        item.title,
        item.link,
        item.pubDate,
        item.content,
        item.contentSnippet,
        item.guid,
        item.isoDate,
      ]
    );
  }
}

const newArticles = await db.all<Article>(
  "SELECT rowid AS id, * FROM articles WHERE pubDate > datetime('now', '-3 days')"
);

// const newArticles = [
//   {
//     id: 1,
//     link: "https://www.20min.ch/story/5-franken-fuer-korrektes-entsorgen-das-ist-eine-frechheit-631368736837",
//   },
// ];

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: {
    width: 1400,
    height: 6000,
  },
});

const page = await browser.newPage();
await page.goto("https://20min.ch");

await page
  .waitForSelector("#onetrust-accept-btn-handler")
  .then((el) => el.click());

await page.close();

for (const article of newArticles) {
  const page = await browser.newPage();

  await page.goto(article.link);
  const hasComments = await navigateToCommentPage(page);

  if (!hasComments) {
    await page.close();
    continue;
  }

  await autoScroll(page);

  const comments = await getCommentsFromPage(page);

  await writeFile("./comments.json", JSON.stringify(comments, null, 2));

  await Promise.all(
    comments.map(
      async (comment) => await insertComment(article.id, null, comment)
    )
  );

  // await page.close();
  break;
}

await db.close();
