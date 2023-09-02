#!/usr/bin/env node
import { join } from "node:path";
import * as url from "node:url";
import { parseArgs } from "node:util";

import puppeteer, { Page } from "puppeteer";
import Parser from "rss-parser";
import { PromisePool } from "@supercharge/promise-pool";
import axios from "axios";
import { formatDistance } from "date-fns";
import * as cheerio from "cheerio";

import { RSSFeedArticle, TwentyMinFeed } from "./RSSFeed.js";
import { db } from "./db/db.js";
import { seed } from "./db/seed.js";
import { readFile } from "fs/promises";
import { autoScroll } from "./helpers.js";
import { Article } from "./article/article.js";
import {
  getRecentArticles,
  getUpdatedArticles,
  insertArticle,
} from "./article/repository.js";
import {
  getCreatedComments,
  getUpdatedComments,
  insertComment,
} from "./comment/repository.js";
import { Comment } from "./comment/comment.js";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { log, createLogTimer } from "./utils/logger.js";

const TIMEOUT = parseInt(process.env.TWENTY_MIN_TIMEOUT) || 500_000;

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const parseCommentFn = await readFile(
  join(__dirname, "./parseComment.js"),
  "utf-8"
);

const { values: args } = parseArgs({
  allowPositionals: true,
  options: {
    parallel: {
      type: "string",
      short: "p",
      default: "1",
    },
    ["no-headless"]: {
      type: "boolean",
      short: "n",
      default: false,
    },
  },
});

const parallel = parseInt(args.parallel);

/////////////////////////////////////////////////////////////////////////////////////

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
    return false;
  }

  const href = await allekommentare.evaluate((el) =>
    (el as any).getAttribute("href")
  );
  await page.goto(`https://20min.ch${href}`);
  return true;
}

/////////////////////////////////////////////////////////////////////////////////////

async function scanArticleComments(page: Page, article: Article) {
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

/////////////////////////////////////////////////////////////////////////////////////

async function getArticleContent(article: Article) {
  if (!article.link) {
    return;
  }
  const html = await axios.get(article.link).then((res) => res.data);
  const $ = cheerio.load(html);

  if ($('[class*="Article_body"]').length === 0) {
    return;
  }
  $('[type="typeInfoboxSummary"]').remove();
  $('[class*="Article_elementSlideshow"]').remove();
  const text = NodeHtmlMarkdown.translate(
    $('[class*="Article_body"]').first().html()
  );
  await db.run("UPDATE articles SET content = ? WHERE guid = ?", [
    text,
    article.guid,
  ]);
}

/////////////////////////////////////////////////////////////////////////////////////

async function acceptCookieBanner() {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(TIMEOUT);
  await page.goto("https://20min.ch");

  await page
    .waitForSelector("#onetrust-accept-btn-handler")
    .then((el) => el.click());

  await page.close();
}

/////////////////////////////////////////////////////////////////////////////////////

console.log(`
==========================================
              20 MIN SCANNER              

VERSION: __VERSION__
PARALLEL: ${parallel}
NO HEADLESS: ${args["no-headless"]}
TIMEOUT (ms): ${TIMEOUT}

==========================================

`);

await seed();
log("Starting scan");
const scanStartedTime = new Date();

const parser = new Parser<TwentyMinFeed>();
const result = await parser.parseURL(
  "https://partner-feeds.beta.20min.ch/rss/20minuten"
);

/// SYNC ARTICLES
const syncArticles = createLogTimer("Syncing articles");
await Promise.all(result.items.map(async (item) => await insertArticle(item)));
syncArticles.end();
const newArticles = await getRecentArticles();

// SCRAPING ARTICLES CONTENT
const scrapingArticles = createLogTimer("Scraping articles content");

await PromisePool.for(newArticles)
  .withConcurrency(parallel)
  .onTaskFinished(async (item, pool) => {
    scrapingArticles.step(item.link, pool.processedPercentage());
  })
  .handleError(async (error, item) => {
    scrapingArticles.error(`Error while scraping ${item.title}`);
    console.error(error);
  })
  .process((item) => getArticleContent(item));

// STARTING CHROME

const startingChrome = createLogTimer("Starting chrome");
const browser = await puppeteer.launch({
  headless: !args["no-headless"],
  // executablePath: "chromium-browser",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  defaultViewport: {
    width: 1400,
    height: 6000,
  },
});
startingChrome.end();

const acceptingCookeBanner = createLogTimer("Accepting Cookie Banner");
await acceptCookieBanner();
acceptingCookeBanner.end();

const scanningComments = createLogTimer("Scanning comments");
await PromisePool.for(newArticles)
  .withConcurrency(parallel)
  .onTaskFinished(async (article, pool) => {
    scanningComments.step(article.title, pool.processedPercentage());
  })
  .handleError(async (error, article) => {
    scanningComments.error(`Error while scanning ${article.title}`);
    console.error(error);
  })
  .process(async (article) => {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT);
    try {
      return await scanArticleComments(page, article);
    } catch (err) {
      await page.close();
      throw err;
    }
  });

scanningComments.end();

const scanEndedTime = new Date();

console.log(`
RESULT 
===================================
SCAN STARTED: ${scanStartedTime.toISOString()}
SCAN ENDED: ${scanEndedTime.toISOString()}
ELAPSED: ${formatDistance(scanEndedTime, scanStartedTime, {
  includeSeconds: true,
})}
===================================
UPDATES:
  Articles: ${getUpdatedArticles()}
  Comments: ${getUpdatedComments()}

CREATES:
  Articles: ${getUpdatedArticles()}
  Comments: ${getCreatedComments()}
`);

await browser.close();
await db.close();

process.on("uncaughtException", async (error, source) => {
  await browser.close();
  await db.close();
  console.error(error);
});
