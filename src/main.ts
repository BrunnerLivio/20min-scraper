#!/usr/bin/env node
import puppeteer, { Page } from "puppeteer";
import Parser from "rss-parser";
import { TwentyMinFeed } from "./RSSFeed.js";
import { db } from "./db/db.js";
import { seed } from "./db/seed.js";
import { readFile } from "fs/promises";
import { autoScroll } from "./helpers.js";
import { Article } from "./article/article.js";
import { PromisePool } from "@supercharge/promise-pool";
import { getUpdatedArticles, insertArticle } from "./article/repository.js";
import {
  getCreatedComments,
  getUpdatedComments,
  insertComment,
} from "./comment/repository.js";
import { Comment } from "./comment/comment.js";
import { join } from "node:path";
import * as url from "node:url";
import { parseArgs } from "node:util";
import { formatDistance } from "date-fns";
import chalk from "chalk";

const log = (message: string) =>
  console.log(`[${chalk.magenta(new Date().toISOString())}] ${message}`);

const createLogTimer = (startMessage: string) => {
  log(`┌── ${startMessage}`);
  const start = new Date();

  const end = () => {
    const end = new Date();

    const duration = formatDistance(start, end, {
      includeSeconds: true,
    });

    log(
      `└── ${chalk.green("✅ Finished")}: ${startMessage} [${chalk.blue(
        "Δ " + duration
      )}]`
    );
  };

  const step = (message: string, percentage: number) => {
    log(
      `├── ${chalk.blue(
        "🕞 Step [" + Math.round(percentage) + "%]"
      )}: ${message}`
    );
  };

  const error = (message: string) => {
    log(`├── ${chalk.red("❌ Error")}: ${message}`);
  };

  return { end, step, error };
};

/////////////////////////////////////////////////////////////////////////////////////

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

/////////////////////////////////////////////////////////////////////////////////////

const parseCommentFn = await readFile(
  join(__dirname, "./parseComment.js"),
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

async function scanArticleComments(article: Article) {
  const page = await browser.newPage();

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

async function acceptCookieBanner() {
  const page = await browser.newPage();
  await page.goto("https://20min.ch");

  await page
    .waitForSelector("#onetrust-accept-btn-handler")
    .then((el) => el.click());

  await page.close();
}

/////////////////////////////////////////////////////////////////////////////////////

const { values: args, positionals } = parseArgs({
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

await seed();
log("Starting scan");
const scanStartedTime = new Date();

const parser = new Parser<TwentyMinFeed>();
const result = await parser.parseURL(
  "https://partner-feeds.beta.20min.ch/rss/20minuten"
);

/// SYNC ARTICLES
const syncArticles = createLogTimer("Syncing articles");

await Promise.all(
  result.items.map(async (item) => {
    await insertArticle(item);
  })
);

syncArticles.end();

const newArticles = await db.all<Article>(
  "SELECT rowid AS id, * FROM articles WHERE pubDate > datetime('now', '-3 days')"
);

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
    return await scanArticleComments(article);
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
