import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';

const app = express();
const PORT = 3001; // separate from Vite dev server

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const DATA_FILE = path.resolve('d:/amine codes/Vault_ Digital Lux/all_products.json');

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} title
 * @property {string} [account_type]
 * @property {string} [offer_type]
 * @property {string} [duration]
 * @property {string} [description]
 * @property {string} [delivery_method]
 * @property {number} [price_usd]
 * @property {number} [price_dzd]
 * @property {string} [supplier]
 * @property {string} [product_url]
 * @property {string} [logo_url]
 * @property {boolean} [active] - whether this product/offer is visible to customers
 * @property {number} [sort_order]
 */

// Helper to read the data wrapper
async function readWrapper() {
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);
  if (data.products && Array.isArray(data.products)) {
    return data; // wrapper object: { status, timestamp, total_products, products }
  }
  if (Array.isArray(data)) {
    // legacy flat array – wrap it
    return { status: "ok", timestamp: new Date().toISOString(), total_products: data.length, products: data };
  }
  throw new Error('Invalid JSON structure');
}

// Helper to get just the products array
async function readData() {
  const wrapper = await readWrapper();
  return wrapper.products;
}

// Write queue to prevent concurrent writes corrupting JSON
let writeQueue = Promise.resolve();

// Helper to write the JSON file (with wrapper)
async function writeData(products) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const wrapper = {
          status: "success",
          timestamp: new Date().toISOString(),
          total_products: products.length,
          products
        };
        const content = JSON.stringify(wrapper, null, 2);
        // Write to temp file first, then rename (atomic)
        const tmpFile = DATA_FILE + '.tmp';
        await fs.writeFile(tmpFile, content, 'utf-8');
        await fs.rename(tmpFile, DATA_FILE);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

// GET all products
app.get('/api/products', async (_req, res) => {
  try {
    const products = await readData();
    res.json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET a single product by id
app.get('/api/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const products = await readData();
    const product = products.find(p => p.id === id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST a new product
app.post('/api/product/new', async (req, res) => {
  try {
    const payload = req.body;
    const products = await readData();
    const newId = 'product-' + Date.now();
    const newProduct = {
      id: newId,
      title: payload.title || 'Untitled',
      account_type: payload.account_type || null,
      offer_type: payload.offer_type || null,
      duration: payload.duration || null,
      description: payload.description || null,
      delivery_method: payload.delivery_method || null,
      price_usd: payload.price_usd ?? null,
      price_dzd: payload.price_dzd ?? null,
      supplier: payload.supplier || null,
      product_url: payload.product_url || null,
      logo_url: payload.logo_url || null,
      active: payload.active !== undefined ? payload.active : true,
      sort_order: payload.sort_order ?? 0,
    };
    products.push(newProduct);
    await writeData(products);
    res.status(201).json(newProduct);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update existing product
app.put('/api/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const products = await readData();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    const existing = products[idx];
    const updated = { ...existing, ...payload };
    products[idx] = updated;
    await writeData(products);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH bulk update multiple products
app.patch('/api/products/bulk', async (req, res) => {
  try {
    const updates = req.body; // array of { id, ...fields }
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array of updates' });
    const products = await readData();
    for (const up of updates) {
      const idx = products.findIndex(p => p.id === up.id);
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...up };
      }
    }
    await writeData(products);
    res.json({ success: true, updated: updates.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: map product title to family name (mirrors client.ts getFamilyName)
function getFamilyName(title) {
  const lower = title.toLowerCase();
  if (lower.includes("adobe")) return "Adobe Creative Cloud";
  if (lower.includes("amazon") || lower.includes("prime video")) return "Amazon Prime Video";
  if (lower.includes("capcut")) return "Capcut";
  if (lower.includes("chatgpt")) return "ChatGPT";
  if (lower.includes("claude")) return "Claude";
  if (lower.includes("crunchyroll")) return "Crunchyroll";
  if (lower.includes("cursor")) return "Cursor";
  if (lower.includes("deepseek")) return "DeepSeek";
  if (lower.includes("discord")) return "Discord Nitro";
  if (lower.includes("disney")) return "Disney+";
  if (lower.includes("duolingo")) return "Duolingo";
  if (lower.includes("grammarly")) return "Grammarly";
  if (lower.includes("iptv")) return "IPTV Subscriptions";
  if (lower.includes("kaspersky")) return "Kaspersky Antivirus";
  if (lower.includes("midjourney")) return "Midjourney";
  if (lower.includes("netflix")) return "Netflix";
  if (lower.includes("office") || lower.includes("microsoft 365")) return "Microsoft Office";
  if (lower.includes("spotify")) return "Spotify";
  if (lower.includes("shahid")) return "Shahid VIP";
  if (lower.includes("youtube")) return "YouTube Premium";
  if (lower.includes("zoom")) return "Zoom Meetings";
  if (lower.includes("vpn") || lower.includes("nordvpn")) return "NordVPN";
  if (lower.includes("canva")) return "Canva Pro";
  if (lower.includes("scribd")) return "Scribd";
  if (lower.includes("windows")) return "Windows License Key";
  if (lower.includes("antigravity")) return "Antigravity Slot";
  if (lower.includes("brazzers")) return "Brazzers";
  if (lower.includes("perplexity")) return "Perplexity";
  if (lower.includes("gemini")) return "Gemini";
  if (lower.includes("notion")) return "Notion";
  if (lower.includes("github")) return "GitHub";
  if (lower.includes("alight motion")) return "Alight Motion";
  if (lower.includes("picsart")) return "PicsArt";
  if (lower.includes("headspace")) return "Headspace";
  return title.split(" - ")[0].trim();
}

function familySlug(familyName) {
  return familyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// POST family-level update (ALL product fields → applies to JSON offers)
app.post('/api/product/family-update', async (req, res) => {
  try {
    const {
      productId, name, main_image, visible, featured,
      description, short_description, original_price_dzd,
      account_type, offer_type, delivery_type,
      rating, rating_count, sales_count,
      seo_title, seo_description, banner_image,
      original_title,
    } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });
    
    const slug = productId.replace('prod-', '');
    const products = await readData();
    
    // Find all offers belonging to this family
    const familyProducts = products.filter(p => familySlug(getFamilyName(p.title)) === slug);
    if (familyProducts.length === 0) {
      return res.status(404).json({ error: `No offers found for family slug: ${slug}` });
    }
    
    let updatedCount = 0;
    let firstIdx = -1;
    
    for (let i = 0; i < familyProducts.length; i++) {
      const fp = familyProducts[i];
      const idx = products.findIndex(p => p.id === fp.id);
      if (idx === -1) continue;
      
      // Track the first offer for first-only fields
      if (firstIdx === -1) firstIdx = idx;
      
      // === Fields applied to ALL offers in the family ===
      if (visible !== undefined) {
        products[idx].active = visible;
      }
      if (account_type !== undefined) {
        products[idx].account_type = account_type;
      }
      if (offer_type !== undefined) {
        products[idx].offer_type = offer_type;
      }
      if (delivery_type !== undefined) {
        products[idx].delivery_method = delivery_type;
      }
      
      updatedCount++;
    }
    
    // === Fields applied to the FIRST offer only ===
    if (firstIdx !== -1) {
      if (main_image !== undefined) {
        products[firstIdx].logo_url = main_image;
      }
      if (description !== undefined) {
        products[firstIdx].description = description;
      }
      if (original_price_dzd !== undefined) {
        products[firstIdx].original_price_dzd = original_price_dzd;
      }
      if (rating !== undefined) {
        products[firstIdx].rating = rating;
      }
      if (rating_count !== undefined) {
        products[firstIdx].rating_count = rating_count;
      }
      if (sales_count !== undefined) {
        products[firstIdx].sales_count = sales_count;
      }
      if (featured !== undefined) {
        products[firstIdx].featured = featured;
      }
      if (seo_title !== undefined) {
        products[firstIdx].seo_title = seo_title;
      }
      if (seo_description !== undefined) {
        products[firstIdx].seo_description = seo_description;
      }
      if (banner_image !== undefined) {
        products[firstIdx].banner_image = banner_image;
      }
      if (short_description !== undefined) {
        products[firstIdx].short_description = short_description;
      }
      if (original_title !== undefined) {
        products[firstIdx].original_title = original_title;
      }
    }
    
    await writeData(products);
    res.json({ success: true, updated: updatedCount, slug });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a product
app.delete('/api/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const products = await readData();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    products.splice(idx, 1);
    await writeData(products);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST scrape product from Z2U — accepts URL (server-side attempt) or raw HTML
app.post('/api/scrape/z2u', async (req, res) => {
  try {
    const { url, html: rawHtml } = req.body;
    let html = rawHtml || '';

    if (url && !html) {
      if (!url.toLowerCase().includes('z2u.com')) return res.status(400).json({ error: 'Not a Z2U URL' });
      console.log(`[Scraper] Fetching: ${url}`);
      try {
        const fetchResp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
          signal: AbortSignal.timeout(10000),
        });
        if (fetchResp.ok) {
          html = await fetchResp.text();
        } else {
          // 403/etc — return a hint to use HTML paste instead
          return res.status(422).json({
            error: `Z2U returned ${fetchResp.status}. Please open the page in your browser, right-click → View Page Source, copy all HTML and paste below.`,
            blockedByCloudflare: true,
          });
        }
      } catch (fetchErr) {
        return res.status(422).json({
          error: `Failed to fetch: ${fetchErr.message}. Try pasting HTML source instead.`,
          blockedByCloudflare: true,
        });
      }
    }

    if (!html || html.length < 500) {
      return res.status(400).json({ error: 'No HTML content provided. Paste URL or page source.' });
    }
    
    // --- Extract data from HTML ---
    
    // Title from h1
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const original_title = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : 'Unknown';
    // Clean common suffixes for display title
    let title = original_title.replace(/\s*\(Global\)\s*/i, '').replace(/\s*Global\s*/i, '').trim();
    
    // Price USD - try multiple patterns
    let price_usd = null;
    const pricePatterns = [
      /\$\s*([\d.]+)/,                          // $2.27 or $ 2.27
      /USD\s*([\d.]+)/i,                         // USD 2.27
      /([\d.]+)\s*USD/i,                         // 2.27 USD
      /data-price="([\d.]+)"/,                    // data-price="2.27"
      /&#36;\s*([\d.]+)/,                         // &#36;2.27 (HTML entity)
      /&dollar;\s*([\d.]+)/,                      // &dollar;2.27
      /"price":\s*"?([\d.]+)"?/,                  // JSON-LD or structured data
      /class="[^"]*price[^"]*"[^>]*>\s*\$?\s*([\d.]+)/i, // .price class with value
    ];
    for (const pat of pricePatterns) {
      const m = html.match(pat);
      if (m) {
        const val = parseFloat(m[1]);
        if (val > 0 && val < 10000) { price_usd = val; break; }
      }
    }
    
    // Duration
    let duration = null;
    const durationPatterns = [
      [/(\d+)\s*years?/i, (m) => m[1] === '1' ? '1 Year' : `${m[1]} Years`],
      [/(\d+)\s*months?/i, (m) => m[1] === '1' ? '1 Month' : `${m[1]} Months`],
      [/(\d+)\s*days?/i, (m) => m[1] === '1' ? '1 Day' : `${m[1]} Days`],
      [/lifetime/i, () => 'Lifetime'],
    ];
    for (const [pat, fmt] of durationPatterns) {
      const m = html.match(pat);
      if (m) { duration = fmt(m); break; }
    }
    if (!duration) {
      // Try from title
      for (const [pat, fmt] of durationPatterns) {
        const m = title.match(pat);
        if (m) { duration = fmt(m); break; }
      }
    }
    
    // Account type
    const htmlLower = html.toLowerCase();
    let account_type = 'Private';
    if (htmlLower.includes('shared account') || title.toLowerCase().includes('shared')) {
      account_type = 'Shared';
    } else if (htmlLower.includes('family') || htmlLower.includes('duo') || title.toLowerCase().includes('family')) {
      account_type = 'Family';
    }
    
    // Offer type
    const titleLower = title.toLowerCase();
    let offer_type = 'Standard';
    if (titleLower.includes('premium')) offer_type = 'Premium';
    else if (titleLower.includes('pro')) offer_type = 'Pro';
    else if (titleLower.includes('plus')) offer_type = 'Plus';
    else if (titleLower.includes('max')) offer_type = 'Max';
    
    // Supplier
    let supplier = 'Z2U';
    const sellerMatch = html.match(/seller[-_]?name[^>]*>([^<]+)</i) || html.match(/class="[^"]*seller[^"]*"[^>]*>([^<]+)</i);
    if (sellerMatch) supplier = sellerMatch[1].trim();
    
    // Logo URL
    let logo_url = null;
    const imgMatch = html.match(/<img[^>]*src="(https?:\/\/[^"]+\.(?:png|jpg|jpeg|webp|gif))"[^>]*>/i);
    if (imgMatch) logo_url = imgMatch[1];
    
    // Description - take meta description or first long paragraph
    let description = '';
    const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (metaDesc) {
      description = metaDesc[1].slice(0, 400);
    } else {
      const textOnly = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const sentenceMatch = textOnly.match(/([^.]{100,400}\.)/);
      if (sentenceMatch) description = sentenceMatch[1].trim();
    }
    if (!description) description = `High-quality ${title}.`;
    description = description + ' Delivered instantly. Experience the best with digitmine - your first choice for digital products.';
    
    // Delivery method
    let delivery_method = 'Account Delivery';
    if (htmlLower.includes('instant delivery')) delivery_method = 'Instant Delivery';
    else if (htmlLower.includes('email')) delivery_method = 'Email Delivery';
    
    // Price DZD (fixed rate 240)
    const price_dzd = price_usd ? Math.round(price_usd * 240) : null;
    
    const scraped = {
      original_title,
      title,
      account_type,
      offer_type,
      duration,
      description,
      delivery_method,
      price_usd,
      price_dzd,
      supplier,
      product_url: url,
      logo_url,
    };

    console.log(`[Scraper] Done: ${title} | $${price_usd} | ${duration}`);
    res.json(scraped);
  } catch (e) {
    console.error('[Scraper] Error:', e.message);
    res.status(500).json({ error: `Scrape failed: ${e.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Local product API listening at http://localhost:${PORT}`);
});
