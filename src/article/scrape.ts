import axios from "axios";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { db } from "../db/db.js";
import { Article } from "./article.js";
import * as cheerio from "cheerio";
import { insertAuthor } from "../author/repository.js";

async function getBreadcrumb($: cheerio.CheerioAPI, article: Article) {
  const scripts = $('script[type="application/ld+json"]');
  if (scripts.length === 0) {
    return;
  }

  const script = scripts
    .map((_, el) => $(el))
    .get()
    .find((el) => el.html().includes("BreadcrumbList"));

  const breadcrumbs = JSON.parse(script.html() || "").itemListElement;
  if (!breadcrumbs) {
    return;
  }

  const category = breadcrumbs
    .slice(0, breadcrumbs.length - 1)
    .map((breadcrumb: any) => breadcrumb.item.name)
    .join(" > ");

  await db.run("UPDATE articles SET category = ? WHERE guid = ?", [
    category,
    article.guid,
  ]);
}

async function getArticleContent($: cheerio.CheerioAPI, article: Article) {
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

async function getArticleAuthor($: cheerio.CheerioAPI, article: Article) {
  let authors = [];
  if ($('[class*="Article_elementAuthors"]').first().length) {
    authors = $('[class*="Article_elementAuthors"]')
      .first()
      .text()
      .replace("von", "")
      .split(",")
      .map((author) => author.trim())
      .filter((author) => author !== "");
  }

  if ($('[class*="VideoContent_lead"]').first().length) {
    authors = $('[class*="VideoContent_lead"]')
      .first()
      .next()
      .text()
      .replace("von", "")
      .split(",")
      .map((author) => author.trim());
  }

  for (const author of authors) {
    await insertAuthor(author, article.id);
  }
}

async function scrape(article: Article) {
  if (!article.link) {
    return;
  }

  const html = await axios.get(article.link).then((res) => res.data);
  const $ = cheerio.load(html);
  await Promise.all([
    getBreadcrumb($, article),
    getArticleContent($, article),
    getArticleAuthor($, article),
  ]);
}

export default scrape;
