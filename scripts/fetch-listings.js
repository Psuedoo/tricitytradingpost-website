#!/usr/bin/env node

/**
 * fetch-listings.js
 *
 * Calls the GunBroker REST API to retrieve seller listings and writes
 * a static listings.json file.  Designed to run in GitHub Actions so
 * the API dev-key is never shipped to the browser.
 *
 * Required environment variables:
 *   GUNBROKER_DEV_KEY  – your GunBroker REST API DevKey
 *
 * Optional environment variables:
 *   GUNBROKER_API_BASE – API base URL (default: production)
 *                        Set to https://api.sandbox.gunbroker.com for sandbox.
 *   GUNBROKER_SELLER_ID – numeric seller ID (default: 1305569)
 *   GUNBROKER_PAGE_SIZE – items per request    (default: 96)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

/* ── Load .env for local development ───────────────────────────────── */

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^\s*([\w]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    });
}

/* ── Configuration ─────────────────────────────────────────────────── */

const DEV_KEY = process.env.GUNBROKER_DEV_KEY;
if (!DEV_KEY) {
  console.error("Error: GUNBROKER_DEV_KEY environment variable is not set.");
  process.exit(1);
}

const API_BASE = (
  process.env.GUNBROKER_API_BASE || "https://api.gunbroker.com"
).replace(/\/+$/, "");

const SELLER_ID = process.env.GUNBROKER_SELLER_ID || "1305569";
const PAGE_SIZE = Number(process.env.GUNBROKER_PAGE_SIZE) || 96;
const OUT_FILE = path.resolve(__dirname, "..", "listings.json");

/* ── Helpers ───────────────────────────────────────────────────────── */

/**
 * Minimal HTTPS/HTTP GET that returns parsed JSON.
 */
function getJson(url, headers) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        // Consume body to free the socket
        res.resume();
        return reject(
          new Error(`HTTP ${res.statusCode} from ${url}`)
        );
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`Invalid JSON from ${url}: ${err.message}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Normalise a single item from the GunBroker Items response into a
 * small, browser-friendly object.
 */
function normaliseListing(raw) {
  const itemId = raw.itemID || raw.ItemID || raw.itemId;
  const title = String(raw.title || raw.Title || raw.name || "").trim();
  if (!itemId || !title) return null;

  const url = `https://www.gunbroker.com/item/${itemId}`;

  // Prefer the thumbnail; fall back to the first picture URL
  let image =
    raw.thumbnailUrl ||
    raw.ThumbnailURL ||
    raw.pictureURL ||
    raw.mainImageUrl ||
    "";
  if (!image && Array.isArray(raw.pictureUrls) && raw.pictureUrls.length) {
    image = raw.pictureUrls[0];
  }
  if (!image && Array.isArray(raw.pictures) && raw.pictures.length) {
    image = raw.pictures[0].url || raw.pictures[0].pictureUrl || "";
  }

  // Price logic: prefer Buy Now, then current bid, then starting bid
  let price = "";
  const buyNow = Number(raw.buyPrice || raw.BuyPrice || raw.buyNowPrice || 0);
  const currentBid = Number(raw.currentBid || raw.CurrentBid || 0);
  const startingBid = Number(raw.startingBid || raw.StartingBid || raw.minimumBid || 0);

  const amount = buyNow || currentBid || startingBid;
  if (amount > 0) {
    price = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } else {
    price = "See listing";
  }

  // Listing type label
  let type = "";
  if (buyNow > 0 && currentBid <= 0) type = "Buy Now";
  else if (currentBid > 0) type = "Auction";
  else if (startingBid > 0) type = "Auction";

  const timeLeft = raw.timeLeft || raw.TimeLeft || "";
  const bidCount = Number(raw.bidCount || raw.BidCount || 0);

  return { url, title, image, price, type, timeLeft, bidCount };
}

/* ── Main ──────────────────────────────────────────────────────────── */

async function main() {
  console.log(`Fetching GunBroker listings for seller ${SELLER_ID}…`);
  console.log(`API base: ${API_BASE}`);

  const headers = {
    "Content-Type": "application/json",
    "X-DevKey": DEV_KEY,
  };

  // The Items endpoint supports paging; fetch up to PAGE_SIZE items.
  const searchUrl =
    `${API_BASE}/v1/Items` +
    `?SellerId=${encodeURIComponent(SELLER_ID)}` +
    `&PageSize=${PAGE_SIZE}` +
    `&Sort=1`; // 1 = most recently listed first

  let items = [];

  try {
    const data = await getJson(searchUrl, headers);

    // The API returns { results: [...], countReturned, ... }
    const results = Array.isArray(data)
      ? data
      : data.results || data.Results || data.items || data.Items || [];

    items = results.map(normaliseListing).filter(Boolean);
    console.log(`Fetched ${items.length} listing(s) from the API.`);
  } catch (err) {
    console.error("Failed to fetch listings:", err.message);
    // If the API is down, write an empty array so the site still works.
    // The frontend will show the fallback link.
  }

  const output = {
    fetchedAt: new Date().toISOString(),
    sellerId: SELLER_ID,
    count: items.length,
    items,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote ${items.length} listing(s) to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
