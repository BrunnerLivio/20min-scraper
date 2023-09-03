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

## Configuration


*Arguments*

| Name                | Description                               | Type      | Default |
|:--------------------|:------------------------------------------|:----------|:--------|
| `--parallel, -p`    | Number of tabs it should open in parallel | `number`  | 1       |
| `--no-headless, -n` | Runs with Chrome headful                  | `boolean` | `false` |

*Env Variables*

| Name                                | Description                                              | Type     | Default            |
|:------------------------------------|:---------------------------------------------------------|:---------|:-------------------|
| `TWENTY_MIN_DB_FILE`                | Where the db.sqlite file is stored                       | `string` | `./data/db.sqlite` |
| `TWENTY_MIN_TIMEOUT`                | What is the timeout when trying to open a new page in ms | `number` | `500000`           |
| `TWENTY_MIN_CHROME_EXECUTABLE_PATH` | Path to the chromium executable                          | `string` | -                  |
