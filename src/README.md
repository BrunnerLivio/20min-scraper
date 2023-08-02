## 20 Min scraper

Scrapes 20min.ch and collects the articles as well as the comments.
It uses SQLite as database

## Getting Started

**Node**:

```bash
npm ci
npm start
```

**Docker**:

```bash
docker build -t 20min-scraper .
docker run -t 20min-scraper
```