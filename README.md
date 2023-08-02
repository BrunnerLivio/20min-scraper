## 20 Min scraper

Scrapes 20min.ch and collects the articles as well as the comments.
It uses SQLite as database

## Getting Started

**Using a crontab**:

Run `crontab -e`

```bash
0 */4 * * * <USER> docker run --pull=always  -v "/YOUR_DB_LOCATION/data:/app/data" -t ghcr.io/brunnerlivio/20min-scraper:main
```

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