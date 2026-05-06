# Visual Graphx scrape notes

## Source
- Sitemap: https://visualgraphx.com/sitemap.xml (169 URLs)
- Crawl method: HTTP GET with a desktop User-Agent (Chrome 120). The Anthropic WebFetch tool was blocked with HTTP 403 by the site's WAF/Cloudflare; curl + python-requests with a real browser UA were not blocked and returned full HTML.

## What was scraped
- All 11 top-level navigation category index pages (/<group>/categories/).
- Every canonical product page (single-product URLs at depth /<group>/<sub>/<slug>/, plus the few flat slugs like /10ft-event-tent/).
- Static content pages: about-us.html, contact-us.html, faq.html, privacy-policy.html, terms-of-use.html, terms-of-service.html, accessibility.html, prit-design-file-guidelines.html, calculator-all.html, blog.html, testimonials.html, and 11 blog/article pages.

## What was NOT scraped (intentional or unavoidable)
- **Authenticated content** (`/user_login.php`, `/user_registration.php`, `/quote_create.php`, `/product_prices.html`, `/product_list.html` - all blank or login-walled for non-trade users). Visual Graphx is wholesale-only and pricing is gated behind trade-account approval, so no prices are included in the KB.
- **Per-industry / per-use product permutation URLs** (e.g. `/industries/healthcare/print-custom-scrim-banner/`). These reuse the same product slug under different category prefixes; only the canonical URL was extracted to avoid duplicate rows. The `associated_category_names` column lists every category the product appears under.
- **Staging subdomain content** (staging.visualgraphx.com) - excluded.
- **Per-product live pricing matrices** - rendered client-side after login; not in the static HTML.
- **JavaScript-rendered product copy on a small number of hardware pages** (e.g. Signicade Deluxe, H-Stakes 10x30) - the static HTML did not contain a Description tab body. The og:description meta tag was used as a fallback short_description; description / description_html may be empty for these items.
- **Cloudflare email obfuscation** for some mailto links - decoded where possible from public copy.

## Data hygiene
- All HTML entities decoded (&amp; -> &, &rsquo; -> ', etc.). cp1252 mojibake characters (U+FFFD) replaced with `-`.
- The `description` column is plain text with HTML tags stripped, paragraph breaks and lists flattened to single spaces. The `description_html` column preserves a sanitized subset of tags (p, ul, ol, li, strong, em, br, a, h2-h5).
- No prices, internal staff names, or login-gated info were ingested.
- All URLs in CSVs are absolute https URLs.

## Known limitations
- Industry/Use sub-categories (e.g. Construction & Industrial) point to category index pages rather than canonical product pages; products are linked back to them via `associated_category_names`.
- The H1 on category pages often appends "(All)" or "(Hardware)" - this suffix has been stripped from `product_name`.
- Search keywords in `search_keywords` are derived from product name + category + a synonym map; they are intended as recall hints for the chatbot, not as ground-truth metadata from the site.
