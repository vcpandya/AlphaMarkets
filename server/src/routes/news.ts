import { Router, Request, Response, NextFunction } from "express";
import { validateJinaKey } from "../middleware/validateKeys.js";
import { searchNews } from "../services/jinaService.js";
import { searchFinanceNews } from "../services/alphaVantageService.js";
import { NewsSearchRequest, NewsSearchResult, NewsArticle } from "../types/index.js";

const router = Router();

router.post(
  "/search",
  (req: Request, res: Response, next: NextFunction) => {
    const { newsSource } = req.body as NewsSearchRequest;
    const source = newsSource || "jina";

    // Only require Jina key if using jina or both
    if (source === "jina" || source === "both") {
      return validateJinaKey(req, res, next);
    }

    // For alphavantage-only, skip Jina validation
    next();
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        topic,
        location,
        datePeriod,
        previousArticleUrls,
        newsSource,
        tickers,
        manualArticles,
      } = req.body as NewsSearchRequest;

      const source = newsSource || "jina";

      // If no topic, use a broad financial news query based on date range
      const effectiveTopic = topic || "global financial markets economy news";

      // Check Alpha Vantage key inline if needed
      const alphaVantageKey = req.headers["x-alphavantage-key"] as string | undefined;
      if ((source === "alphavantage" || source === "both") && !alphaVantageKey) {
        res.status(401).json({
          error: "Missing Alpha Vantage API key (x-alphavantage-key header)",
        });
        return;
      }

      const previousUrls = new Set(previousArticleUrls || []);

      let articles: NewsArticle[] = [];

      // Skip API fetching if no newsSource is set and manualArticles are provided
      const skipApiFetch = !newsSource && manualArticles && manualArticles.length > 0;

      if (!skipApiFetch) {
        if (source === "jina") {
          articles = await searchNews(
            req.jinaKey!,
            effectiveTopic,
            location || "",
            datePeriod
          );
        } else if (source === "alphavantage") {
          articles = await searchFinanceNews(
            alphaVantageKey!,
            effectiveTopic,
            tickers,
            datePeriod?.from,
            datePeriod?.to
          );
        } else if (source === "both") {
          const [jinaArticles, avArticles] = await Promise.all([
            searchNews(req.jinaKey!, effectiveTopic, location || "", datePeriod),
            searchFinanceNews(
              alphaVantageKey!,
              effectiveTopic,
              tickers,
              datePeriod?.from,
              datePeriod?.to
            ),
          ]);

          // Merge and deduplicate by URL
          const seenUrls = new Set<string>();
          articles = [];

          for (const article of [...jinaArticles, ...avArticles]) {
            if (!seenUrls.has(article.url)) {
              seenUrls.add(article.url);
              articles.push(article);
            }
          }
        }
      }

      // Prepend manual articles (they take priority)
      if (manualArticles && manualArticles.length > 0) {
        const seenUrls = new Set(articles.map((a) => a.url));
        const uniqueManual = manualArticles.filter((a) => !seenUrls.has(a.url));
        articles = [...uniqueManual, ...articles];
      }

      // Mark articles as new or previously seen
      const taggedArticles = articles.map((article) => ({
        ...article,
        isNew: !previousUrls.has(article.url),
      }));

      const newCount = taggedArticles.filter((a) => a.isNew).length;

      const result: NewsSearchResult = {
        articles: taggedArticles,
        stats: {
          total: taggedArticles.length,
          new: newCount,
          previouslySeen: taggedArticles.length - newCount,
        },
      };

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
