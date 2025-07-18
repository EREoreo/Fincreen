// server.js
import express from 'express';
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist folder in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Хранилище задач в памяти (в продакшне используйте Redis)
const jobs = new Map();

// Все параметры взяты из вашего рабочего скрипта
const BASE_URLS = {
  nyse: 'https://finviz.com/screener.ashx?v=111&f=exch_nyse,ind_stocksonly,sh_avgvol_o300,sh_price_o5',
  nasdaq: 'https://finviz.com/screener.ashx?v=111&f=exch_nasd,ind_stocksonly,sh_avgvol_o300,sh_price_o5',
};

const TOTAL = 1355;
const PER_PAGE = 20;
const OFFSETS = Array.from(
  { length: Math.ceil(TOTAL / PER_PAGE) },
  (_, i) => (i === 0 ? 1 : i * PER_PAGE + 1)
);
const CONCURRENCY = 3; // Уменьшено для стабильности на Render

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrapeOffset(page, baseUrl, offset) {
  const url = offset === 1 ? baseUrl : `${baseUrl}&r=${offset}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  const tickers = await page.$$eval(
    'a[href*="quote.ashx?t="]',
    links => Array.from(new Set(
      links
        .map(a => a.textContent.trim())
        .filter(t => /^[A-Z]+$/.test(t) && t !== 'USA')
    ))
  );
  return tickers;
}

async function runScrapingJob(jobId, exchange) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'processing';
    
    const baseUrl = BASE_URLS[exchange] || BASE_URLS.nyse;
    
    // Настройки Puppeteer для Render
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    // Создаем пул из вкладок
    const pages = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => browser.newPage())
    );
    
    for (const page of pages) {
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType()))
          req.abort();
        else
          req.continue();
      });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36'
      );
    }

    const all = new Set();

    // Пакетная навигация по offset
    for (let i = 0; i < OFFSETS.length; i += CONCURRENCY) {
      const batch = OFFSETS.slice(i, i + CONCURRENCY);
      console.log(`[${jobId}] Scraping offsets: ${batch.join(', ')}`);
      
      const results = await Promise.all(
        batch.map((offset, idx) => 
          scrapeOffset(pages[idx % pages.length], baseUrl, offset)
            .catch(err => {
              console.error(`Error scraping offset ${offset}:`, err);
              return [];
            })
        )
      );
      
      results.flat().forEach(t => all.add(t));
      console.log(`[${jobId}] Accumulated: ${all.size}`);
      
      // Обновляем прогресс
      job.progress = Math.round((i + CONCURRENCY) / OFFSETS.length * 100);
      
      // Небольшая пауза между батчами
      await sleep(1000);
    }

    await browser.close();

    // Убираем USA, если попало
    all.delete('USA');
    const tickers = Array.from(all);

    // Сохраняем результат
    const csv = tickers.join('\n');
    job.result = csv;
    job.status = 'done';
    job.progress = 100;
    
    console.log(`[${jobId}] Completed with ${tickers.length} tickers`);
    
  } catch (error) {
    console.error(`[${jobId}] Error:`, error);
    job.status = 'error';
    job.error = error.message;
  }
}

// API Routes
app.get('/api/finviz', async (req, res) => {
  const ex = (req.query.exchange || 'nyse').toLowerCase();
  const jobId = uuidv4();
  
  // Создаем временную задачу
  jobs.set(jobId, {
    id: jobId,
    exchange: ex,
    status: 'processing',
    progress: 0,
    result: null,
    error: null,
    createdAt: new Date()
  });
  
  try {
    await runScrapingJob(jobId, ex);
    const job = jobs.get(jobId);
    
    if (job.status === 'done') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${ex}-tickers.csv"`
      );
      res.send(job.result);
    } else {
      res.status(500).json({ error: job.error || 'Unknown error' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    jobs.delete(jobId);
  }
});

// Асинхронные endpoint'ы
app.post('/api/finviz/start', async (req, res) => {
  const exchange = (req.query.exchange || 'nyse').toLowerCase();
  const jobId = uuidv4();
  
  jobs.set(jobId, {
    id: jobId,
    exchange,
    status: 'processing',
    progress: 0,
    result: null,
    error: null,
    createdAt: new Date()
  });
  
  runScrapingJob(jobId, exchange);
  res.json({ jobId });
});

app.get('/api/finviz/status', (req, res) => {
  const jobId = req.query.jobId;
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json({
    status: job.status,
    progress: job.progress,
    error: job.error
  });
});

app.get('/api/finviz/download', (req, res) => {
  const jobId = req.query.jobId;
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (job.status !== 'done') {
    return res.status(400).json({ error: 'Job not completed' });
  }
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${job.exchange}-tickers.csv"`
  );
  res.send(job.result);
  jobs.delete(jobId);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Очистка старых задач
setInterval(() => {
  const now = new Date();
  for (const [jobId, job] of jobs) {
    const age = (now - job.createdAt) / 1000 / 60;
    if (age > 30) {
      jobs.delete(jobId);
      console.log(`Cleaned up old job: ${jobId}`);
    }
  }
}, 10 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});