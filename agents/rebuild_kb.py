"""Rebuild Visual Graphx products.csv and faqs.csv from scratch.

New schema (products.csv):
  product_id, product_name, default_category_name, associated_category_names,
  image, product_url, short_description, description, search_keywords

New schema (faqs.csv):
  faq_id, question, answer, category, faq_type, product_ids, category_ids,
  search_keywords
"""
from __future__ import annotations

import csv
import html as html_lib
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
HEADERS = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}

KB_DIR = Path(r"D:\chatwoot-custom-master\kb")
INPUT_PRODUCTS_CSV = KB_DIR / "products.csv"
OUT_PRODUCTS_CSV = KB_DIR / "products.csv"
OUT_FAQS_CSV = KB_DIR / "faqs.csv"

# ---------- HTTP ----------

def fetch(url: str, retries: int = 3, sleep: float = 0.6) -> str:
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                time.sleep(sleep)
                return r.text
            last = f"HTTP {r.status_code}"
        except Exception as e:
            last = str(e)
        time.sleep(1.0 + i)
    print(f"  ! fetch failed: {url} ({last})")
    return ""

# ---------- HTML parsing ----------

def get_meta(html: str, name: str) -> str:
    m = re.search(
        r'<meta[^>]+(?:name|property)=["\']' + re.escape(name) + r'["\'][^>]*content=["\']([^"\']+)',
        html,
        re.IGNORECASE,
    )
    if not m:
        return ""
    return html_lib.unescape(m.group(1)).strip()

def get_h1(html: str) -> str:
    m = re.search(r'(?is)<h1[^>]*>(.*?)</h1>', html)
    if not m:
        return ""
    text = re.sub(r'<[^>]+>', ' ', m.group(1))
    return clean_text(text)

def extract_pro_disc(html: str) -> str:
    """Extract the long product description text from #pro-disc block."""
    idx = html.find('id="pro-disc"')
    if idx == -1:
        return ""
    # find the > that closes the opening div tag
    open_end = html.find('>', idx)
    if open_end == -1:
        return ""
    sub = html[open_end + 1 :]
    # depth-track div tags
    depth = 0
    i = 0
    end = -1
    while i < len(sub):
        if sub[i : i + 5] == "<div ":
            depth += 1
            i += 5
        elif sub[i : i + 5] == "<div>":
            depth += 1
            i += 5
        elif sub[i : i + 6] == "</div>":
            if depth == 0:
                end = i
                break
            depth -= 1
            i += 6
        else:
            i += 1
    if end == -1:
        return ""
    content = sub[:end]
    content = re.sub(r"(?is)<style.*?</style>", " ", content)
    content = re.sub(r"(?is)<script.*?</script>", " ", content)
    text = re.sub(r"<[^>]+>", " ", content)
    return clean_text(html_lib.unescape(text))

def clean_text(t: str) -> str:
    t = t.replace("\xa0", " ")
    # Replace U+FFFD (replacement char from cp1252 mojibake) with sensible defaults
    t = t.replace("�", "'")
    t = re.sub(r"\s+", " ", t)
    return t.strip()

# ---------- Description shaping ----------

def split_sentences(t: str) -> list[str]:
    # crude sentence splitter
    t = re.sub(r"\s+", " ", t).strip()
    parts = re.split(r"(?<=[\.\!\?])\s+(?=[A-Z])", t)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        out.append(p)
    return out

# Patterns of marketing fluff to skip in long descriptions
NOISE_RE = re.compile(
    r"(visual graphx in arizona|made in arizona|order online today|click here|"
    r"phoenix az|same-day|fast turnaround.*?nationwide|nationwide shipping|"
    r"contact us|get a quote|request a quote|free quote|delivered nationwide)",
    re.IGNORECASE,
)

def build_description(long_text: str, og_desc: str, name: str) -> str:
    """Compose a 250-600 char, 3-5 sentence plain description.

    Prefer real on-page text; fall back to og:description; never identical
    to short_description.
    """
    candidates: list[str] = []
    if long_text:
        sents = split_sentences(long_text)
        for s in sents:
            if len(s) < 20 or len(s) > 280:
                continue
            if any(bad in s.lower() for bad in (" we ", " our ", " your ")):
                # OK, these are fine actually
                pass
            # reject pure CTA or contact lines
            if re.search(r"^(contact|call|email|order|click|shop|browse|learn more)\b", s, re.IGNORECASE) and len(s) < 80:
                continue
            candidates.append(s)
    # Fallback to og_desc if nothing
    if not candidates and og_desc:
        candidates = split_sentences(og_desc)

    out: list[str] = []
    total = 0
    for s in candidates:
        if total + len(s) + 1 > 580:
            break
        if s in out:
            continue
        out.append(s)
        total += len(s) + 1
        if len(out) >= 5 and total > 280:
            break
    desc = " ".join(out).strip()
    if len(desc) < 250 and og_desc and og_desc not in desc:
        # pad with og_desc
        if desc:
            desc = (desc + " " + og_desc).strip()
        else:
            desc = og_desc
    # normalize spaces
    desc = clean_text(desc)
    if len(desc) > 590:
        desc = desc[:587].rsplit(" ", 1)[0] + "..."
    return desc

def build_short(name: str, long_text: str, og_desc: str, description: str, default_cat_label: str) -> str:
    """One sentence 80-140 chars, plain text, NEVER identical to description first sentence."""
    # Try first short sentence from long_text that's 60-140 chars
    pool: list[str] = []
    if long_text:
        for s in split_sentences(long_text):
            if 60 <= len(s) <= 140:
                pool.append(s)
    # pick one not identical to description start
    desc_start = description[:80].lower() if description else ""
    for s in pool:
        if s[:60].lower() not in desc_start:
            return s
    # build a synthesized one
    label = default_cat_label.lower()
    name_clean = name.replace('"', "")
    candidates = [
        f"Custom {name_clean} from Visual Graphx for {label} signage, displays, and branding projects.",
        f"Order {name_clean} printed by Visual Graphx in Arizona for retail, events, and outdoor advertising.",
        f"Visual Graphx {name_clean}: durable, full-color print solution for trade shows, storefronts, and promotions.",
        f"Wholesale {name_clean} printing from Visual Graphx with fast turnaround for sign shops and trade resellers.",
    ]
    desc_lower = description.lower()
    for c in candidates:
        if c[:60].lower() not in desc_lower and 70 <= len(c) <= 140:
            return c
    # last resort: clip og_desc
    s = og_desc.strip()
    if len(s) > 140:
        s = s[:137].rsplit(" ", 1)[0] + "..."
    if len(s) >= 60:
        return s
    return candidates[0]

# ---------- Keyword brainstorming ----------

# Map of "concept" -> base keywords
CONCEPT_KW = {
    "banner": [
        "banner", "banners", "vinyl banner", "custom banner", "outdoor banner",
        "indoor banner", "large format", "signage", "advertising", "marketing",
        "event banner", "trade show", "storefront", "retail", "promotional",
        "weather resistant", "durable", "custom size", "hemmed", "grommets",
    ],
    "scrim": [
        "scrim", "scrim banner", "13oz", "heavy duty", "vinyl", "weatherproof",
        "fabric", "outdoor",
    ],
    "mesh": [
        "mesh", "mesh banner", "wind resistant", "fence banner", "perforated",
        "outdoor banner", "construction banner",
    ],
    "fabric": [
        "fabric", "fabric banner", "polyester", "soft signage", "trade show",
        "tension fabric",
    ],
    "blockout": [
        "blockout", "blockout fabric", "two-sided", "double sided", "opaque",
        "vivid",
    ],
    "decal": [
        "decal", "decals", "sticker", "stickers", "vinyl decal", "custom decal",
        "vinyl sticker", "branding", "graphics", "logo decal",
    ],
    "cut_vinyl": [
        "cut vinyl", "die cut", "die-cut", "contour cut", "kiss cut",
        "lettering", "vinyl letters",
    ],
    "reflective": [
        "reflective", "reflective sticker", "reflective decal", "high visibility",
        "safety", "night visibility", "hi-vis",
    ],
    "floor": [
        "floor decal", "floor graphics", "floor sticker", "floor sign", "non-slip",
        "anti-slip", "high traffic", "retail floor", "way-finding",
    ],
    "wall": [
        "wall decal", "wall graphic", "wall mural", "wall art", "wall wrap",
        "indoor decor", "office decor", "branding",
    ],
    "window": [
        "window", "window decal", "window graphic", "window film", "window cling",
        "storefront", "glass", "perforated window", "one-way vision", "privacy",
        "frosted",
    ],
    "perforated": [
        "perforated", "perforated film", "perforated vinyl", "see-through",
        "one-way", "storefront window", "vehicle window",
    ],
    "clear": [
        "clear", "transparent", "see through", "see-through", "clear vinyl",
    ],
    "frosted": [
        "frosted", "frosted film", "frosted decal", "etched glass look",
        "privacy film",
    ],
    "magnet": [
        "magnet", "magnets", "car magnet", "vehicle magnet", "magnetic sign",
        "fridge magnet", "promotional magnet", "removable",
    ],
    "poster": [
        "poster", "posters", "poster print", "movie poster", "advertising poster",
        "indoor poster", "wall poster", "marketing", "promotional",
    ],
    "backlit": [
        "backlit", "backlit poster", "lightbox", "illuminated", "movie display",
        "transit advertising",
    ],
    "canvas": [
        "canvas", "canvas print", "canvas banner", "wall art", "photo canvas",
        "stretched canvas",
    ],
    "wrap": [
        "wrap", "wrap film", "vehicle wrap", "car wrap", "fleet wrap",
        "color change", "vinyl wrap", "wall wrap", "wrap vinyl",
    ],
    "wrap_3m": [
        "3M", "3m wrap", "ij35c", "40c", "v9500", "premium wrap", "OEM wrap",
    ],
    "wrap_avery": [
        "Avery", "Avery Dennison", "v4000", "mpi 1405", "premium wrap film",
    ],
    "wrap_arlon": [
        "Arlon", "v9500", "v9700", "wrap film", "long-term outdoor",
    ],
    "coroplast": [
        "coroplast", "corrugated plastic", "yard sign", "real estate sign",
        "election sign", "construction sign", "lightweight", "weatherproof",
    ],
    "yard_sign": [
        "yard sign", "yard signs", "lawn sign", "real estate sign",
        "election sign", "political sign", "campaign sign", "open house sign",
    ],
    "acm": [
        "acm", "acp", "aluminum composite", "dibond", "rigid sign", "outdoor sign",
        "metal sign", "weatherproof", "long term",
    ],
    "pvc": [
        "pvc", "expanded pvc", "sintra", "rigid plastic sign", "indoor sign",
        "outdoor sign", "lightweight rigid",
    ],
    "foamboard": [
        "foamboard", "foam board", "foamcore", "foam core", "presentation board",
        "lightweight rigid", "indoor sign", "trade show", "event sign",
    ],
    "bubble_board": [
        "bubble board", "bubbleboard", "rigid board", "lightweight panel",
        "display board",
    ],
    "polypanel": [
        "polypanel", "poly panel", "rigid panel", "lightweight rigid",
        "outdoor signage",
    ],
    "polyboard": [
        "polyboard", "poly board", "rigid board", "panel sign",
    ],
    "acrylic": [
        "acrylic", "acrylic sign", "acrylic print", "plexiglass", "plexiglas",
        "plastic sign", "indoor sign", "office sign", "lobby sign",
        "premium sign", "clear", "glossy", "matte", "modern sign",
    ],
    "a_frame": [
        "a-frame", "a frame", "sandwich board", "sidewalk sign", "portable sign",
        "self-standing", "double sided",
    ],
    "signicade": [
        "signicade", "sidewalk sign", "a-frame", "plastic frame", "portable display",
    ],
    "h_stake": [
        "h-stake", "h stakes", "wire stake", "yard sign stake", "metal stake",
    ],
    "retractable": [
        "retractable banner", "retractable stand", "pull-up banner", "roll-up",
        "trade show display", "portable banner", "banner stand",
    ],
    "tent": [
        "tent", "event tent", "canopy", "pop-up tent", "branded tent",
        "outdoor tent", "trade show tent", "10x10 tent",
    ],
    "table_cover": [
        "table cover", "tablecloth", "trade show table", "branded table cover",
        "fitted cover",
    ],
    "tension_fabric": [
        "tension fabric display", "fabric display", "trade show display",
        "fabric backdrop",
    ],
    "easy_dot": [
        "easy dot", "removable adhesive", "low tack", "repositionable",
    ],
    "high_tack": [
        "high tack", "strong adhesive", "textured surface", "permanent",
    ],
    "high_perf": [
        "high performance", "long-term outdoor", "fade resistant", "uv resistant",
        "premium vinyl",
    ],
    "low_tack": [
        "low tack", "removable", "residue free", "easy peel",
    ],
    "fabricmate": [
        "fabricmate", "fabric track", "stretch fabric", "wall track", "acoustic panel",
    ],
    "curtain_track": [
        "curtain track", "curtain rail", "ceiling track", "hospital curtain",
        "aluminum track",
    ],
    "design": [
        "design service", "graphic design", "creative design", "art services",
        "design help", "logo design", "layout design",
    ],
    "vinyl": [
        "vinyl", "self adhesive vinyl", "sav", "adhesive film",
    ],
    "outdoor": ["outdoor", "weatherproof", "uv resistant", "weather resistant"],
    "indoor": ["indoor", "interior", "office", "retail"],
}

GENERIC_TAIL = [
    "custom printing", "wholesale", "trade printer", "sign shop", "print shop",
    "Visual Graphx", "Arizona", "wide format",
]

def kw_for(*concepts: str, extra: list[str] | None = None) -> list[str]:
    out: list[str] = []
    for c in concepts:
        out.extend(CONCEPT_KW.get(c, []))
    if extra:
        out.extend(extra)
    out.extend(GENERIC_TAIL)
    # de-dupe preserving order, lowercase
    seen = set()
    final: list[str] = []
    for k in out:
        kk = k.strip()
        if not kk:
            continue
        kl = kk.lower()
        if kl in seen:
            continue
        seen.add(kl)
        final.append(kk)
    return final

# ---------- Per-product keyword definitions ----------

# Map product_id -> (concepts, extra_keywords)
PRODUCT_KW_MAP: dict[int, tuple[list[str], list[str]]] = {
    1:  (["window", "perforated", "vinyl", "decal"], ["one-way vision", "vehicle window", "storefront graphic"]),
    2:  (["h_stake", "yard_sign", "coroplast"], ["10x30 stake", "metal stake", "yard sign hardware"]),
    3:  (["decal", "vinyl"], ["general performance", "standard decal", "everyday vinyl"]),
    4:  (["decal", "clear", "vinyl", "window"], ["clear sticker", "transparent decal", "see through sticker"]),
    5:  (["coroplast"], ["vinyl mounted", "mounted coroplast", "rigid coroplast", "promotional sign"]),
    6:  (["acm"], ["vinyl mounted", "mounted ACM", "rigid metal sign", "professional sign"]),
    7:  (["bubble_board"], ["vinyl mounted", "mounted bubble board", "lightweight panel"]),
    8:  (["polypanel"], ["vinyl mounted", "mounted polypanel", "rigid panel sign"]),
    9:  (["decal", "high_tack", "vinyl"], ["aggressive adhesive", "rough surface decal", "concrete decal"]),
    10: (["banner", "scrim"], ["scrim vinyl", "13oz vinyl", "outdoor banner", "event banner"]),
    11: (["banner", "mesh"], ["fence banner", "wind resistant banner", "construction banner", "outdoor mesh"]),
    12: (["coroplast", "yard_sign"], ["full color coroplast", "real estate sign", "election sign"]),
    13: (["acm"], ["dibond", "outdoor metal sign", "long-term sign", "branding panel"]),
    14: (["bubble_board"], ["direct print", "rigid panel", "trade show sign"]),
    15: (["polypanel"], ["rigid sign", "outdoor advertising", "polypanel sign"]),
    16: (["a_frame", "coroplast"], ["self standing", "sidewalk sign", "double sided", "promotional"]),
    17: (["magnet"], ["car door magnet", "vehicle door magnet", "team magnet", "magnet sign"]),
    18: (["foamboard"], ["foamcore sign", "presentation board", "trade show foam"]),
    19: (["foamboard"], ["ultraboard", "premium foamboard", "thick foamboard", "rigid foam"]),
    20: (["acrylic"], ["custom acrylic", "office acrylic", "lobby acrylic", "acrylic display"]),
    21: (["acrylic", "clear"], ["clear acrylic", "see through acrylic", "transparent acrylic", "clear plexiglass"]),
    22: (["poster"], ["custom poster", "large poster", "indoor poster", "ad poster"]),
    23: (["polyboard"], ["rigid board sign", "lightweight rigid sign"]),
    24: (["design"], ["hourly design", "creative print design", "in-house design"]),
    25: (["pvc"], ["sintra", "rigid pvc", "lightweight rigid sign"]),
    26: (["signicade", "a_frame"], ["plastic a frame", "deluxe sidewalk sign", "real estate stand"]),
    27: (["coroplast"], ["oversized coroplast", "large format coroplast", "billboard coroplast"]),
    28: (["decal", "cut_vinyl"], ["custom cut decal", "die cut sticker", "vinyl lettering", "logo decal"]),
    29: (["yard_sign", "coroplast"], ["safety yard sign", "construction yard sign", "lawn sign"]),
    30: (["wrap", "wrap_avery"], ["v4000 vinyl", "fleet wrap", "vehicle graphics", "Avery wrap"]),
    31: (["decal", "cut_vinyl", "reflective"], ["reflective lettering", "safety decal", "high visibility sticker"]),
    32: (["poster", "backlit"], ["backlit film", "lightbox poster", "movie poster display"]),
    33: (["acrylic"], ["matte acrylic", "non-glare acrylic", "frosted acrylic look", "premium acrylic"]),
    34: (["decal", "floor"], ["custom floor decal", "non slip floor", "social distancing floor"]),
    35: (["decal", "low_tack", "window"], ["GF221", "low tack glass", "removable window decal"]),
    36: (["decal", "vinyl"], ["3M 40c", "3M decal", "general signage", "point of sale decal"]),
    37: (["wrap", "wrap_3m"], ["3M wrap film", "color change wrap", "fleet wrap", "premium 3M"]),
    38: (["decal", "low_tack", "window"], ["low tack glass decal", "removable glass decal", "easy install"]),
    39: (["decal", "wall"], ["GF285", "wall decal", "interior decor", "branded wall"]),
    40: (["banner"], ["banner stand film", "retractable film", "pull-up film", "roll-up banner"]),
    41: (["decal", "high_perf", "vinyl"], ["high performance vinyl", "long term decal", "fleet decal"]),
    42: (["decal", "floor"], ["multi grip", "MultiGRIP", "anti slip floor", "heavy traffic decal"]),
    43: (["decal", "wall", "wrap_3m"], ["3M IJ35c", "wall decal", "laminated decal", "premium decal"]),
    44: (["decal", "easy_dot", "low_tack"], ["easy dot decal", "repositionable", "removable wall decal"]),
    45: (["wrap", "wrap_avery", "wall"], ["Avery MPI 1405", "wall wrap", "interior wrap", "high gloss"]),
    46: (["decal", "floor"], ["heavy duty floor", "industrial floor decal", "thick floor decal"]),
    47: (["decal", "clear", "window"], ["optically clear", "crystal clear", "no haze", "premium glass film"]),
    48: (["retractable"], ["retractable hardware", "stand only", "no graphics", "trade show stand"]),
    49: (["retractable"], ["double sided retractable", "with graphics", "trade show display"]),
    50: (["retractable"], ["single sided retractable", "with graphics", "promo banner stand"]),
    51: (["canvas"], ["custom canvas", "photo canvas", "wall canvas", "stretched canvas"]),
    52: (["fabricmate"], ["1/4 inch track", "5 foot track", "fabric track", "wall fabric track"]),
    53: (["fabricmate"], ["flex track", "1/4 inch flex", "curved track", "fabric grip"]),
    54: (["banner", "fabric", "blockout"], ["blockout banner", "double sided banner", "premium fabric banner"]),
    55: (["canvas"], ["faux canvas", "rigid canvas", "industrial canvas", "rigid wall art"]),
    56: (["curtain_track"], ["3 foot track", "ceiling curtain", "wall curtain", "hospital track"]),
    57: (["wrap", "wrap_arlon"], ["Arlon V9700", "vehicle wrap film", "premium wrap", "fleet graphic"]),
    58: (["wrap", "wrap_arlon", "wall"], ["Arlon V9500", "wall wrap", "interior wrap", "premium wrap film"]),
    59: (["decal", "frosted", "window"], ["frosted clear", "etched glass look", "privacy decal", "office glass"]),
    60: (["tent"], ["10ft tent", "event canopy", "pop-up tent", "branded tent"]),
    61: (["table_cover"], ["8ft table cover", "trade show table", "fitted tablecloth"]),
    62: (["tent"], ["20ft canopy", "aluminum canopy", "branded canopy tent", "event tent"]),
    63: (["tension_fabric"], ["straight tension fabric", "fabric backdrop", "trade show display"]),
    64: (["tent"], ["10x10 tent", "advertising tent", "pop up tent", "event canopy"]),
}

# Default category mapping: extract top-level URL segment
def default_category_from_url(url: str) -> str:
    """Return top-level URL segment as the new default_category_name.

    Allowed: roll, rigid, wraps, banners, decals-stickers, hardware-frames,
    services, industries, uses, featured. Special-case the bare-slug featured
    URLs (e.g. /10ft-event-tent/) -> 'featured'.
    """
    p = urlparse(url)
    parts = [s for s in p.path.split("/") if s]
    if not parts:
        return "featured"
    seg = parts[0].lower()
    allowed = {
        "roll", "rigid", "wraps", "banners", "decals-stickers",
        "hardware-frames", "services", "industries", "uses", "featured",
    }
    if seg in allowed:
        return seg
    # bare slugs at root are featured products
    return "featured"

def assoc_categories_from_url(url: str, default: str) -> str:
    # The current data didn't include them; we'll keep empty as the previous version did.
    return ""

# ---------- Main ----------

def load_product_seed() -> list[dict]:
    rows: list[dict] = []
    with open(INPUT_PRODUCTS_CSV, "r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    return rows

def clean_name(n: str) -> str:
    n = re.sub(r"\s*[-|]\s*Visual Graphx.*$", "", n, flags=re.IGNORECASE).strip()
    return n

def process_products():
    seeds = load_product_seed()
    out_rows = []
    print(f"Processing {len(seeds)} products...")
    for seed in seeds:
        pid = int(seed["product_id"])
        name = clean_name(seed["product_name"])
        url = seed["product_url"]
        image = seed["image"]
        default_cat = default_category_from_url(url)
        assoc = assoc_categories_from_url(url, default_cat)

        print(f"[{pid:>2}] {name} -> {url}")
        html = fetch(url)
        og_desc = ""
        long_text = ""
        if html:
            og_desc = get_meta(html, "og:description") or get_meta(html, "description")
            long_text = extract_pro_disc(html)

        og_desc = clean_text(og_desc)
        long_text = clean_text(long_text)

        description = build_description(long_text, og_desc, name)
        short = build_short(name, long_text, og_desc, description, default_cat)

        # Make sure short != description prefix
        if description and short and description[: len(short)].lower().strip() == short.lower().strip():
            # regenerate synthesized short
            short = build_short(name, "", og_desc, description, default_cat)

        kw_concepts, kw_extra = PRODUCT_KW_MAP.get(pid, (["vinyl"], [name.lower()]))
        keywords = kw_for(*kw_concepts, extra=kw_extra + [name.lower()])
        # ensure 15-30
        if len(keywords) < 15:
            keywords += ["printing", "custom print", "graphics", "wide format", "vinyl print"]
            seen = set()
            keywords = [k for k in keywords if not (k.lower() in seen or seen.add(k.lower()))]
        if len(keywords) > 30:
            keywords = keywords[:30]

        out_rows.append(
            dict(
                product_id=pid,
                product_name=name,
                default_category_name=default_cat,
                associated_category_names=assoc,
                image=image,
                product_url=url,
                short_description=short,
                description=description,
                search_keywords=", ".join(keywords),
            )
        )

    # Write CSV
    fieldnames = [
        "product_id", "product_name", "default_category_name",
        "associated_category_names", "image", "product_url",
        "short_description", "description", "search_keywords",
    ]
    with open(OUT_PRODUCTS_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for r in out_rows:
            w.writerow(r)
    print(f"\nWrote {len(out_rows)} products -> {OUT_PRODUCTS_CSV}")
    return out_rows

# ---------- FAQs ----------

# Hand-curated 30 FAQs derived from faq.html, terms-of-use, contact and policy pages.
FAQS: list[dict] = [
    dict(
        question="How long does it take to get approval once I register?",
        answer="Normal turnaround time is within one business day or sooner. If you have not received a confirmation email, please check your spam folder or contact us at admin@2ctmedia.com.",
        category="Account",
        faq_type="general",
        keywords=["approval", "account approval", "register", "registration", "signup", "sign up", "new account", "trade account", "wholesale account", "approval time", "how long approval", "how long signup", "create account", "wait time", "confirmation"],
    ),
    dict(
        question="Will Visual Graphx sell directly to my customer?",
        answer="No. We sell wholesale ONLY and will never sell direct to your customer. Our commitment is to help you grow your business by offering the lowest cost and highest quality product.",
        category="Account",
        faq_type="general",
        keywords=["wholesale", "trade only", "sell direct", "direct to customer", "reseller", "white label", "blind ship", "trade printer", "sign shop", "print shop", "b2b", "wholesale only", "direct sale", "drop ship"],
    ),
    dict(
        question="Can I see pricing before account approval?",
        answer="In order to access our online pricing, you must first receive trade-account approval. Visual Graphx does not sell directly to the public. You must be a trade member such as a sign shop or print shop. Click Get Started on the home page to register.",
        category="Pricing",
        faq_type="general",
        keywords=["pricing", "price", "see pricing", "view pricing", "wholesale pricing", "trade pricing", "cost", "quote", "how much", "price list", "rates", "trade member", "approved customer", "sign in to see prices", "login pricing", "before approval"],
    ),
    dict(
        question="What options are available for product design?",
        answer="There are three options. 1) Custom Design opens our online design studio so you can create your own art. 2) Upload Design lets you submit your own JPG, JPEG, GIF, PNG, EPS, AI, PDF or PSD file. 3) Browse Design lets you pick from hundreds of pre-loaded templates that you can edit in the design studio.",
        category="Products",
        faq_type="general",
        keywords=["design", "design options", "custom design", "upload design", "browse design", "templates", "design studio", "art file", "artwork", "logo upload", "create design", "online designer", "diy design", "design tool", "build your own"],
    ),
    dict(
        question="What equipment and printing technology do you use?",
        answer="Visual Graphx invests in leading-edge technology including UV-LED and GelUV ink systems with print resolution up to 1200 x 1200 dpi. Special features include Matte Ink, White Ink and Even Gloss Inks. Finishing is done on a Multicam Celero 7 CNC table for fast, precise contour, kiss and through cutting.",
        category="Printing",
        faq_type="general",
        keywords=["equipment", "printer", "print technology", "uv led", "gel uv", "1200 dpi", "white ink", "matte ink", "gloss ink", "cnc finishing", "multicam celero", "high resolution print", "industry equipment", "machinery", "printing process"],
    ),
    dict(
        question="Do you offer white ink, clear ink, or matte finishes?",
        answer="Yes. For certain processes Visual Graphx offers white ink, clear ink, and a matte ink process in addition to standard CMYK output. Confirm the available finishes on each product page before placing an order.",
        category="Printing",
        faq_type="general",
        keywords=["white ink", "clear ink", "matte finish", "matte ink", "specialty ink", "cmyk", "finish options", "gloss", "ink type", "spot color", "premium ink", "specialty print", "underprint", "overprint"],
    ),
    dict(
        question="What printing method do you use?",
        answer="Visual Graphx uses primarily UV-LED and GelUV digital printing for the highest quality on signage substrates. Offset printing is used where appropriate for large quantity flat work. The result is sharp images and vivid color on both text and graphics.",
        category="Printing",
        faq_type="general",
        keywords=["printing method", "print process", "offset", "digital print", "uv printing", "high quality", "image quality", "color", "resolution", "sharp print", "vivid color", "method"],
    ),
    dict(
        question="Where is Visual Graphx located?",
        answer="Visual Graphx is based at 7931 E Pecos Rd, Building 4 - Suite 162, Mesa, AZ 85212, United States. Production is done locally in Arizona and orders are shipped nationwide.",
        category="General",
        faq_type="general",
        keywords=["location", "address", "where", "based", "phoenix", "arizona", "mesa az", "headquarters", "office", "factory", "production location", "company address", "warehouse", "near me"],
    ),
    dict(
        question="How can I contact Visual Graphx?",
        answer="You can reach Visual Graphx by phone at (414) 687-5892 or by email at hello@visualgraphx.com. There is also a contact form and a quote request form on the website. Account questions can be sent to admin@2ctmedia.com.",
        category="General",
        faq_type="general",
        keywords=["contact", "phone", "email", "support", "customer service", "reach", "talk to someone", "help", "contact info", "phone number", "email address", "message", "get in touch", "quote request"],
    ),
    dict(
        question="Does Visual Graphx sell to the public, or only to trade members?",
        answer="Visual Graphx sells wholesale ONLY. Customers must be a trade member such as a sign shop, print shop, marketing agency or other resale business. Visual Graphx does not sell to the end consumer.",
        category="Account",
        faq_type="general",
        keywords=["trade only", "wholesale", "sell to public", "consumer", "retail customer", "trade member", "reseller account", "b2b only", "sign shop", "print shop", "wholesale only", "trade account"],
    ),
    dict(
        question="How do I become a registered reseller?",
        answer="Click Get Started on the home page to register. Provide your business details and we will normally approve the account within one business day. Once approved you will see online pricing and can place orders.",
        category="Account",
        faq_type="general",
        keywords=["register", "registration", "get started", "create account", "become reseller", "sign up", "trade application", "new account", "open account", "wholesale signup", "apply", "join", "reseller registration"],
    ),
    dict(
        question="Can I cancel or change my order after it has been placed?",
        answer="Once your order has been processed and moved to production, changes or cancellations cannot be guaranteed. Contact support immediately and the team will try to halt the order. Cancelled orders may be charged for materials and labor already incurred. There is no cancellation or refund on items already in the production queue or completed.",
        category="Returns",
        faq_type="general",
        keywords=["cancel order", "change order", "modify order", "cancellation", "stop order", "edit order", "reorder", "refund", "production queue", "in production", "after order", "order changes", "cancellation policy"],
    ),
    dict(
        question="What is the return or refund policy if there is an issue with my order?",
        answer="Visual Graphx aims for 100% customer satisfaction. If you are unhappy with your order or there is a defect, you must report it within five business days of delivery with a description and pictures. For errors caused by Visual Graphx, replacement product is sent with priority shipping at no charge or a refund may be offered. For customer-side errors after proof approval (typos, low-resolution art, color mismatch on un-color-matched files) Visual Graphx will work with you, but cost recovery may apply.",
        category="Returns",
        faq_type="general",
        keywords=["return", "refund", "policy", "defective", "damaged", "wrong order", "reprint", "replacement", "satisfaction guarantee", "five days", "report issue", "color issue", "typo", "proof approval", "rmaterial"],
    ),
    dict(
        question="What does general performance vs high performance vinyl mean?",
        answer="General-performance (standard) vinyl is a durable, scratch-resistant film suited to most indoor and short to medium-term outdoor use. High-performance vinyl is engineered for longer outdoor durability, conformability over rivets and contours, and resistance to harsh weather. It is typically used for vehicle wraps and long-term outdoor signage.",
        category="Products",
        faq_type="general",
        keywords=["general performance", "high performance", "vinyl difference", "vinyl grade", "vinyl types", "long term vinyl", "short term vinyl", "calendared vinyl", "cast vinyl", "outdoor durability", "wrap film grade", "vehicle wrap vinyl"],
    ),
    dict(
        question="What design file formats can I upload?",
        answer="Visual Graphx accepts JPG, JPEG, GIF, PNG, EPS, AI, PDF and PSD files. You can also use the online design studio (Custom Design) or pick a layout from pre-loaded templates (Browse Design). Vector formats (AI, EPS, PDF) are preferred for sharp prints at any size.",
        category="Products",
        faq_type="general",
        keywords=["file format", "upload format", "ai file", "eps", "pdf", "psd", "jpg", "png", "vector file", "raster", "art file requirement", "supported formats", "accepted files", "submit art"],
    ),
    dict(
        question="How do you ship orders and which carriers do you use?",
        answer="Visual Graphx prints in Arizona and ships nationwide through standard freight and parcel carriers. Once an order is delivered the system generates the final invoice. Express production is available on many products to speed up turnaround. Local pickup is also available at the Mesa, AZ facility.",
        category="Shipping",
        faq_type="general",
        keywords=["shipping", "delivery", "shipping carrier", "ups", "fedex", "freight", "ship time", "ship nationwide", "drop ship", "blind ship", "delivery time", "ship method", "local pickup", "ship from", "ship to"],
    ),
    dict(
        question="What are the standard turnaround times?",
        answer="Standard production is typically 3 to 5 business days after artwork approval, depending on the product and size. Many items offer an Express Production upgrade for faster delivery. Confirm the exact turnaround on each product page before checkout.",
        category="Shipping",
        faq_type="general",
        keywords=["turnaround", "turn around", "lead time", "production time", "how long", "when ready", "fast", "rush", "express production", "expedited", "urgent", "business days", "eta", "delivery time", "processing time"],
    ),
    dict(
        question="Does Visual Graphx offer design services?",
        answer="Yes. Visual Graphx has an in-house design team for creative print design services. The team can build art from scratch, redraw your logo for print, set up a layout, or fix files that are not print-ready. See Services > Design on the website to request design help.",
        category="Products",
        faq_type="general",
        keywords=["design service", "graphic design", "art help", "logo redraw", "layout help", "art services", "creative design", "design team", "design fees", "in-house design", "art preparation", "file fix"],
    ),
    dict(
        question="What materials and brands does Visual Graphx work with?",
        answer="Visual Graphx stocks materials from leading brands including 3M (IJ35c, 40c, V9500 wrap films), Avery Dennison (V4000, MPI 1405), Arlon (V9500, V9700), Orafol/Oracal, Ultraflex, Fisher Textiles and General Formulations. Substrates include coroplast, ACM/ACP, foamboard, acrylic, expanded PVC and polyboard.",
        category="Products",
        faq_type="general",
        keywords=["brands", "materials", "3M", "Avery", "Arlon", "Oracal", "Orafol", "Ultraflex", "Fisher Textiles", "General Formulations", "substrate", "vinyl brand", "media brand", "approved supplier", "premium material"],
    ),
    dict(
        question="Can I order custom sizes?",
        answer="Yes. Most products are available in both standard sizes and custom sizes with options like straight edges, contour cutting, kiss cutting, through cutting, weeding and masking. Use the size calculator on each product page to enter custom dimensions.",
        category="Products",
        faq_type="general",
        keywords=["custom size", "custom dimensions", "any size", "made to size", "size options", "contour cut", "die cut", "kiss cut", "through cut", "trim", "size calculator", "wide format size", "max size", "min size"],
    ),
    dict(
        question="What is your privacy policy?",
        answer="Visual Graphx protects all member registration data and personal information under their Privacy Policy. The site uses cookies and analytics partners (such as Microsoft Clarity and Microsoft Advertising) to understand site usage. Read the full policy at visualgraphx.com/privacy-policy.html.",
        category="General",
        faq_type="general",
        keywords=["privacy", "privacy policy", "data", "personal information", "cookies", "tracking", "gdpr", "ccpa", "data protection", "analytics", "user data", "account data"],
    ),
    dict(
        question="Do you send SMS notifications?",
        answer="Yes. By using Visual Graphx services you agree to receive informational SMS messages such as appointment reminders and account notifications. Message and data rates may apply. Reply STOP to opt out or HELP for help.",
        category="General",
        faq_type="general",
        keywords=["sms", "text message", "notifications", "alerts", "opt out", "stop", "text alerts", "phone notifications", "order updates", "delivery updates", "carrier rates"],
    ),
    dict(
        question="What payment methods does Visual Graphx accept?",
        answer="Approved trade accounts can pay through the Visual Graphx online ordering system using major credit cards. Net terms may be available for established trade customers on request. Contact admin@2ctmedia.com for billing or terms questions.",
        category="Pricing",
        faq_type="general",
        keywords=["payment", "credit card", "visa", "mastercard", "amex", "net terms", "billing", "invoice", "ach", "wire transfer", "terms", "pay", "checkout", "accepted payment"],
    ),
    dict(
        question="Do you offer blind shipping or drop shipping to my customer?",
        answer="Yes. Visual Graphx is wholesale only and routinely blind ships orders directly to your customer with no Visual Graphx branding on the packaging. Provide the destination address at checkout and the order will ship directly to them.",
        category="Shipping",
        faq_type="general",
        keywords=["blind ship", "drop ship", "white label ship", "ship to customer", "no branding", "anonymous ship", "wholesale ship", "private label", "customer address", "direct ship"],
    ),
    dict(
        question="Do you offer color matching or PMS color matching?",
        answer="Yes. Visual Graphx can color match to a Pantone (PMS) reference or to a supplied physical sample on most digital print processes. Color match is a paid add-on and works best when noted at order entry along with a target swatch. Files submitted without a color match request are printed using standard CMYK profiles.",
        category="Printing",
        faq_type="general",
        keywords=["color match", "color matching", "pms", "pantone", "spot color", "brand color", "color accuracy", "color profile", "icc profile", "cmyk", "swatch", "target color", "exact color"],
    ),
    dict(
        question="Can I order a sample or a swatch book before placing a large order?",
        answer="Yes. Visual Graphx offers material samples and printed sample packs for trade customers. Contact your account rep or use the contact form to request a sample of a specific substrate, vinyl or finish before committing to a large run.",
        category="Products",
        faq_type="general",
        keywords=["sample", "samples", "swatch", "material sample", "sample pack", "test print", "proof", "physical sample", "demo", "swatch book", "evaluation", "before order", "test material"],
    ),
    dict(
        question="Do you provide an art proof before printing?",
        answer="Yes. Once your art is uploaded, Visual Graphx provides a digital proof for review. Production does not start until you approve the proof. Customer-side errors after proof approval (typos, low-resolution images) are the customer's responsibility, so review carefully.",
        category="Printing",
        faq_type="general",
        keywords=["proof", "art proof", "digital proof", "before printing", "approval", "approve proof", "proof review", "soft proof", "pdf proof", "preview", "artwork approval", "sign off"],
    ),
    dict(
        question="How should I prepare my artwork for print (file guidelines)?",
        answer="Use vector art (AI, EPS, PDF) at 100% size where possible. For raster art use 150-300 DPI at the final print size. Build files in CMYK with 1/8 inch (3 mm) bleed and convert all text to outlines. See visualgraphx.com/prit-design-file-guidelines.html for the full design file guidelines.",
        category="Printing",
        faq_type="general",
        keywords=["file guidelines", "file setup", "bleed", "dpi", "resolution", "cmyk", "outlines", "vector", "300 dpi", "print ready", "art prep", "file specs", "design guidelines", "fonts", "file requirements"],
    ),
    dict(
        question="Are prices listed in US dollars and which countries do you ship to?",
        answer="All prices on the Visual Graphx website are in US dollars (USD). Visual Graphx ships throughout the United States. International shipping is not standard but may be quoted on a case by case basis - contact support for an international quote.",
        category="Pricing",
        faq_type="general",
        keywords=["currency", "usd", "us dollars", "international", "ship internationally", "canada", "mexico", "ship outside us", "global", "shipping country", "pricing currency", "exchange rate"],
    ),
    dict(
        question="Where can I find product warranties or expected outdoor lifespan?",
        answer="Outdoor lifespan depends on substrate, lamination and exposure - high-performance wrap vinyl and laminated decals can last 5 to 7+ years outdoors, while general-performance media is rated for shorter durations. Check the Description and Specifications tab on each product page for the manufacturer's rated durability.",
        category="Products",
        faq_type="general",
        keywords=["warranty", "lifespan", "durability", "outdoor life", "how long lasts", "5 year", "7 year", "uv life", "weather life", "manufacturer rating", "lamination", "fade", "longevity", "spec sheet"],
    ),
]

def write_faqs():
    rows: list[dict] = []
    for i, f in enumerate(FAQS, start=1):
        # Build keywords list, dedupe
        kws = []
        seen = set()
        for k in f["keywords"]:
            kk = k.strip()
            if not kk:
                continue
            if kk.lower() in seen:
                continue
            seen.add(kk.lower())
            kws.append(kk)
        if len(kws) < 10:
            kws += ["visual graphx", "help", "support", "trade", "wholesale"]
            kws = list(dict.fromkeys(kws))
        if len(kws) > 20:
            kws = kws[:20]
        rows.append(
            dict(
                faq_id=i,
                question=f["question"],
                answer=f["answer"],
                category=f["category"],
                faq_type=f["faq_type"],
                product_ids="",
                category_ids="",
                search_keywords=", ".join(kws),
            )
        )
    fieldnames = [
        "faq_id", "question", "answer", "category", "faq_type",
        "product_ids", "category_ids", "search_keywords",
    ]
    with open(OUT_FAQS_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"Wrote {len(rows)} FAQs -> {OUT_FAQS_CSV}")
    return rows

if __name__ == "__main__":
    products = process_products()
    faqs = write_faqs()
    # quick stats
    avg_kw = sum(len(p["search_keywords"].split(",")) for p in products) / len(products)
    print(f"\nAverage keywords per product: {avg_kw:.1f}")
    same_count = sum(1 for p in products if p["short_description"].strip() == p["description"].strip())
    print(f"Rows where short==description: {same_count}")
    short_only_prefix = sum(
        1 for p in products
        if p["description"].lower().startswith(p["short_description"].lower().rstrip(".!?")[:60])
    )
    print(f"Rows where description starts with short (first 60 chars): {short_only_prefix}")
