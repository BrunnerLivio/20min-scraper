import { Page } from "puppeteer";
import { Article } from "../article/article.js";
import { autoScroll } from "../helpers.js";
import { insertComment } from "./repository.js";
import { Comment } from "./comment.js";
import { readFile } from "fs/promises";
import { join } from "node:path";
import * as url from "node:url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const parseCommentFn = await readFile(
  join(__dirname, "../parseComment.js"),
  "utf-8"
);

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

async function navigateToCommentPage(page: Page) {
  const [allekommentare] = await page.$x(
    "//a[contains(., 'Alle Kommentare anzeigen')]"
  );
  if (!allekommentare) {
    return false;
  }

  const href = await allekommentare.evaluate((el) =>
    (el as any).getAttribute("href")
  );
  await page.goto(`https://20min.ch${href}`);
  return true;
}

async function scrape(page: Page, article: Article) {
  await page.goto(article.link);
  const hasComments = await navigateToCommentPage(page);

  if (!hasComments) {
    await page.close();
    return;
  }

  await autoScroll(page);

  const comments = await getCommentsFromPage(page);
  await page.close();

  const res = await Promise.all(
    comments.map(
      async (comment) => await insertComment(article.id, null, comment)
    )
  );

  return res;
}

export default scrape;
