#!/usr/bin/env node
import { parseArgs } from "node:util";
import puppeteer from "puppeteer";
import Parser from "rss-parser";
import { PromisePool } from "@supercharge/promise-pool";
import { formatDistance } from "date-fns";
import { TwentyMinFeed } from "./RSSFeed.js";
import { db } from "./db/db.js";
import { seed } from "./db/seed.js";
import {
  getRecentArticles,
  getUpdatedArticles,
  insertArticle,
} from "./article/repository.js";
import {
  getCreatedComments,
  getUpdatedComments,
} from "./comment/repository.js";
import { log, createLogTimer } from "./utils/logger.js";
import scrapeArticle from "./article/scrape.js";
import scrapeComment from "./comment/scrape.js";
import { getCreatedAuthors, getUpdatedAuthors } from "./author/repository.js";

const TIMEOUT = parseInt(process.env.TWENTY_MIN_TIMEOUT) || 500_000;
const CHROME_EXECUTABLE_PATH = process.env.TWENTY_MIN_CHROME_EXECUTABLE_PATH;

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
  .process((item) => scrapeArticle(item));

scrapingArticles.end();

// STARTING CHROME

const startingChrome = createLogTimer("Starting chrome");
const browser = await puppeteer.launch({
  headless: !args["no-headless"],
  executablePath: CHROME_EXECUTABLE_PATH,
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
      return await scrapeComment(page, article);
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
  Authors: ${getUpdatedAuthors()}

CREATES:
  Articles: ${getUpdatedArticles()}
  Comments: ${getCreatedComments()}
  Authors: ${getCreatedAuthors()}
`);

await browser.close();
await db.close();

process.on("uncaughtException", async (error, source) => {
  await browser.close();
  await db.close();
  console.error(error);
});
