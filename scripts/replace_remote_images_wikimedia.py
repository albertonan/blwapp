#!/usr/bin/env python3
"""Replace remote food images with Wikimedia Commons images and download locally.

Why:
- Unsplash/source.unsplash can 404/503 and images may not match the cut.
- Wikimedia Commons hosts freely-licensed media with metadata (license/author) suitable for attribution.

What it does:
- Scans data/foods/*.json
- For any http(s) value in imagen_alimento and presentaciones[].imagen (or only for selected foods),
  finds a Wikimedia Commons candidate by search query and downloads an 800px thumbnail.
- Writes the image to assets/images/foods/<food_id>/main.jpg and p_<index>.jpg
- Updates JSON to point to local relative paths.
- Writes data/images/image-attribution.json containing license/author/source URL.

Usage:
  python scripts/replace_remote_images_wikimedia.py

Options:
  --only aguacate platano   Limit to specific food ids.
  --dry-run                Do not download or modify files.
  --timeout 25             Network timeout.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


WIKI_API = "https://commons.wikimedia.org/w/api.php"
UA = "BLWCareWikimediaDownloader/1.0"

# Acceptable licenses (Commons uses many variants; we match loosely)
LICENSE_ALLOW_PAT = re.compile(r"\b(CC0|Public domain|CC BY|CC-BY|CC BY-SA|CC-BY-SA)\b", re.IGNORECASE)
LICENSE_DENY_PAT = re.compile(r"\b(All Rights Reserved|NoDerivatives|ND|NC|NonCommercial)\b", re.IGNORECASE)


def is_http_url(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower().startswith(("http://", "https://"))


def safe_mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def rel_from_root(root: Path, p: Path) -> str:
    return str(p.resolve().relative_to(root.resolve()).as_posix())


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


@dataclass
class Candidate:
    thumb_url: str
    page_title: str
    page_url: str
    author: str
    license_short: str
    license_url: str


def normalize_license(s: str) -> str:
    return (s or "").strip()


def build_query(food_id: str, food_name: str, presentation_title: Optional[str]) -> str:
    # Minimal bilingual heuristics to improve cut matching
    food_map = {
        "aguacate": "avocado",
        "platano": "banana",
        "zanahoria": "carrot",
        "manzana": "apple",
        "patata": "potato",
        "boniato": "sweet potato",
        "pollo": "chicken",
        "huevo": "scrambled eggs",
        "salmon": "salmon",
        "brocoli": "broccoli",
        "fresas": "strawberry",
        "yogur": "yogurt",
    }

    title = (presentation_title or "").lower()
    cut_terms: List[str] = []
    if "tira" in title or "tiras" in title:
        cut_terms += ["strips", "slices"]
    if "bast" in title:
        cut_terms += ["sticks"]
    if "gajo" in title or "gajos" in title:
        cut_terms += ["wedges", "slices"]
    if "cubo" in title or "cubos" in title or "trozos" in title:
        cut_terms += ["cubes", "pieces"]
    if "rall" in title:
        cut_terms += ["grated"]
    if "pur" in title or "chaf" in title:
        cut_terms += ["puree", "mashed"]
    if "revuelto" in title:
        cut_terms += ["scrambled"]
    if "asado" in title:
        cut_terms += ["roasted"]
    if "vapor" in title:
        cut_terms += ["steamed"]
    if "desmenu" in title:
        cut_terms += ["shredded", "pulled"]

    base = food_map.get(food_id, food_name)
    if cut_terms:
        return f"{base} {' '.join(cut_terms)}"
    return str(base)


def required_title_tokens(food_id: str, food_name: str) -> List[str]:
    # Tokens that MUST appear in the Wikimedia file title for relevance.
    tokens_map = {
        "aguacate": ["avocado"],
        "platano": ["banana"],
        "zanahoria": ["carrot"],
        "manzana": ["apple"],
        "patata": ["potato"],
        "boniato": ["sweet_potato", "sweet-potato", "sweet potato", "batata"],
        "pollo": ["chicken"],
        "huevo": ["egg", "eggs"],
        "salmon": ["salmon"],
        "brocoli": ["broccoli"],
        "fresas": ["strawberry", "strawberries"],
        "yogur": ["yogurt", "yoghurt"],
    }
    if food_id in tokens_map:
        return tokens_map[food_id]

    # Fallback: require some part of the food name
    n = (food_name or "").strip().lower().replace(" ", "_")
    return [n] if n else []


def wiki_api(params: Dict[str, str], timeout: int) -> Dict[str, Any]:
    qs = "&".join(f"{k}={quote(v)}" for k, v in params.items())
    url = f"{WIKI_API}?{qs}"
    req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def pick_candidate(query: str, timeout: int, must_have_tokens: List[str]) -> Optional[Candidate]:
    data = wiki_api(
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrnamespace": "6",  # File:
            "gsrsearch": query,
            "gsrlimit": "8",
            "prop": "imageinfo|info",
            "inprop": "url",
            "iiprop": "url|extmetadata",
            "iiurlwidth": "900",
        },
        timeout,
    )

    pages = (data.get("query") or {}).get("pages") or {}
    # Iterate deterministically
    bad_title_tokens = [".pdf", "pdf", "page", "issue", "series", "volume"]
    bad_thumb_tokens = ["page1-", "page2-", "/pdf/"]
    bad_subject_tokens = ["flower", "flowers", "blossom"]

    for _pageid, page in sorted(pages.items(), key=lambda kv: kv[0]):
        imageinfo = (page.get("imageinfo") or [])
        if not imageinfo:
            continue
        ii = imageinfo[0]
        thumb_url = ii.get("thumburl") or ""
        page_url = (page.get("canonicalurl") or page.get("fullurl") or "")
        title = page.get("title") or ""

        title_l = title.lower()
        if any(t in title_l for t in bad_title_tokens):
            continue
        if any(t in thumb_url.lower() for t in bad_thumb_tokens):
            continue
        if must_have_tokens:
            if not any(tok.lower() in title_l for tok in must_have_tokens):
                continue
        # Avoid plant/flower shots for ingredient foods
        if any(t in title_l for t in bad_subject_tokens):
            continue

        meta = (ii.get("extmetadata") or {})
        license_short = normalize_license(strip_html((meta.get("LicenseShortName") or {}).get("value", "")))
        usage = strip_html((meta.get("UsageTerms") or {}).get("value", ""))
        license_url = strip_html((meta.get("LicenseUrl") or {}).get("value", ""))
        author = strip_html((meta.get("Artist") or {}).get("value", ""))

        if not thumb_url or not title:
            continue

        # Filter for acceptable licensing
        lic_blob = " ".join([license_short, usage, license_url])
        if LICENSE_DENY_PAT.search(lic_blob):
            continue
        if not LICENSE_ALLOW_PAT.search(lic_blob):
            continue

        if not page_url:
            page_url = f"https://commons.wikimedia.org/wiki/{quote(title.replace(' ', '_'))}"

        return Candidate(
            thumb_url=thumb_url,
            page_title=title,
            page_url=page_url,
            author=author,
            license_short=license_short or usage or "",
            license_url=license_url,
        )

    return None


def download(url: str, dest: Path, timeout: int) -> None:
    safe_mkdir(dest.parent)
    req = Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*;q=0.8"})
    with urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    with dest.open("wb") as f:
        f.write(data)


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--foods-dir", default="data/foods")
    ap.add_argument("--assets-dir", default="assets/images/foods")
    ap.add_argument("--attrib", default="data/images/image-attribution.json")
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--timeout", type=int, default=25)
    ap.add_argument("--sleep", type=float, default=0.2)
    args = ap.parse_args(argv)

    root = Path(__file__).resolve().parent.parent
    foods_dir = (root / args.foods_dir)
    assets_dir = (root / args.assets_dir)
    attrib_path = (root / args.attrib)

    food_files = sorted(foods_dir.glob("*.json"))
    if args.only:
        only = set(args.only)
        food_files = [f for f in food_files if f.stem in only]

    attributions: List[Dict[str, Any]] = []
    rewritten = 0
    replaced = 0
    errors = 0

    for food_file in food_files:
        data = load_json(food_file)
        food_id = str(data.get("id") or food_file.stem)
        food_name = str(data.get("nombre") or food_id)
        changed = False

        # imagen_alimento
        if is_http_url(data.get("imagen_alimento")):
            q = build_query(food_id, food_name, None)
            must = required_title_tokens(food_id, food_name)
            cand = pick_candidate(q, args.timeout, must)
            if not cand:
                print(f"[WARN] No candidate for {food_id} main (query: {q})")
            else:
                local = assets_dir / food_id / "main.jpg"
                rel = rel_from_root(root, local)
                if args.dry_run:
                    print(f"[DRY] {food_id} main <- {cand.thumb_url}")
                else:
                    try:
                        download(cand.thumb_url, local, args.timeout)
                        data["imagen_alimento"] = rel
                        changed = True
                        replaced += 1
                        attributions.append(
                            {
                                "foodId": food_id,
                                "slot": "imagen_alimento",
                                "localPath": rel,
                                "source": cand.page_url,
                                "file": cand.page_title,
                                "author": cand.author,
                                "license": cand.license_short,
                                "licenseUrl": cand.license_url,
                                "query": q,
                            }
                        )
                        time.sleep(args.sleep)
                    except Exception as e:
                        print(f"[ERROR] Download main for {food_id}: {e}")
                        errors += 1

        pres = data.get("presentaciones")
        if isinstance(pres, list):
            for i, p in enumerate(pres):
                if not isinstance(p, dict):
                    continue
                if not is_http_url(p.get("imagen")):
                    continue

                title = str(p.get("titulo") or f"#{i}")
                q = build_query(food_id, food_name, title)
                must = required_title_tokens(food_id, food_name)
                cand = pick_candidate(q, args.timeout, must)
                if not cand:
                    print(f"[WARN] No candidate for {food_id} p_{i:02d} (query: {q})")
                    continue

                local = assets_dir / food_id / f"p_{i:02d}.jpg"
                rel = rel_from_root(root, local)
                if args.dry_run:
                    print(f"[DRY] {food_id} p_{i:02d} ({title}) <- {cand.thumb_url}")
                    continue

                try:
                    download(cand.thumb_url, local, args.timeout)
                    p["imagen"] = rel
                    changed = True
                    replaced += 1
                    attributions.append(
                        {
                            "foodId": food_id,
                            "slot": f"presentaciones[{i}].imagen",
                            "title": title,
                            "localPath": rel,
                            "source": cand.page_url,
                            "file": cand.page_title,
                            "author": cand.author,
                            "license": cand.license_short,
                            "licenseUrl": cand.license_url,
                            "query": q,
                        }
                    )
                    time.sleep(args.sleep)
                except Exception as e:
                    print(f"[ERROR] Download {food_id} p_{i:02d}: {e}")
                    errors += 1

        if changed and not args.dry_run:
            dump_json(food_file, data)
            rewritten += 1

    if not args.dry_run:
        safe_mkdir(attrib_path.parent)
        with attrib_path.open("w", encoding="utf-8") as f:
            json.dump({"items": attributions}, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print("\n--- Summary ---")
    print(f"Food files scanned: {len(food_files)}")
    print(f"JSON files rewritten: {rewritten}")
    print(f"Images replaced: {replaced}")
    print(f"Errors: {errors}")
    if not args.dry_run:
        print(f"Attribution: {attrib_path.as_posix()}")

    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
