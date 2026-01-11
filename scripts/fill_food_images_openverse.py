#!/usr/bin/env python3
"""Auto-fill food images using Openverse (CC0) and download locally.

This avoids scraping BLW websites (often copyrighted) and provides license-safe images.

What it does:
- Scans data/foods/*.json
- For each remote image URL (http/https) and/or missing image (optional), searches Openverse for CC0 photos
- Downloads the selected image to assets/images/foods/<food_id>/main.jpg and p_<index>.jpg
- Updates JSON to point to local paths
- Writes data/images/image-attribution.json with Openverse metadata
- Regenerates data/images/food-images.json (list of local image paths)

Usage:
  python scripts/fill_food_images_openverse.py

Options:
  --only <ids...>         Limit to specific food ids
  --include-missing       Also fill null images (default: only replace remote)
  --dry-run               Don't download or write
  --timeout 25            Network timeout
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
from urllib.error import HTTPError, URLError

OPENVERSE = "https://api.openverse.engineering/v1/images/"
UA = "BLWCareOpenverseDownloader/1.0"

# Openverse anonymous requests are limited to page_size <= 20.
OPENVERSE_ANON_MAX_PAGE_SIZE = 20


def is_http_url(v: Any) -> bool:
    return isinstance(v, str) and v.strip().lower().startswith(("http://", "https://"))


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


def http_get_json(url: str, timeout: int) -> Dict[str, Any]:
    headers = {"User-Agent": UA, "Accept": "application/json"}

    class KeepHeadersRedirectHandler(HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            new_req = super().redirect_request(req, fp, code, msg, hdrs, newurl)
            if new_req is None:
                return None
            # Re-apply headers on redirect (urllib may drop them)
            for k, v in headers.items():
                new_req.add_header(k, v)
            return new_req

    opener = build_opener(KeepHeadersRedirectHandler())
    req = Request(url, headers=headers)
    # Retry/backoff for transient errors
    for attempt in range(4):
        try:
            with opener.open(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(1.0 * (2**attempt))
                continue
            raise
        except URLError:
            if attempt < 3:
                time.sleep(1.0 * (2**attempt))
                continue
            raise

    raise RuntimeError("Openverse request failed")


def http_download(url: str, dest: Path, timeout: int) -> None:
    safe_mkdir(dest.parent)
    req = Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*;q=0.8"})
    with urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    with dest.open("wb") as f:
        f.write(data)


def build_query(food_id: str, food_name: str, title: Optional[str]) -> str:
    food_map = {
        "aguacate": "avocado",
        "platano": "banana",
        "zanahoria": "carrot",
        "manzana": "apple",
        "patata": "potato",
        "boniato": "sweet potato",
        "pollo": "chicken",
        "huevo": "egg",
        "salmon": "salmon",
        "brocoli": "broccoli",
        "fresas": "strawberry",
        "yogur": "yogurt",
    }

    t = (title or "").lower()
    # Build a more natural English query: <method> <ingredient> <cut>
    method: Optional[str] = None
    cut: Optional[str] = None

    # Methods / preparations
    if "rall" in t:
        method = "grated"
    elif "pur" in t or "chaf" in t:
        method = "mashed"
    elif "revuelto" in t:
        method = "scrambled"
    elif "asado" in t:
        method = "roasted"
    elif "vapor" in t:
        method = "steamed"
    elif "desmenu" in t:
        method = "shredded"

    # Cuts / shapes
    if "bast" in t:
        cut = "sticks"
    elif "gajo" in t or "gajos" in t:
        cut = "wedges"
    elif "tira" in t or "tiras" in t:
        cut = "strips"
    elif "cubo" in t or "cubos" in t:
        cut = "cubes"
    elif "trozos" in t:
        cut = "pieces"

    base = str(food_map.get(food_id, food_name))
    parts: List[str] = []
    if method:
        parts.append(method)
    parts.append(base)
    if cut:
        parts.append(cut)
    return " ".join(parts)


def ingredient_tag(food_id: str, food_name: str) -> str:
    # Used for Openverse `tags=` filter
    tag_map = {
        "aguacate": "avocado",
        "platano": "banana",
        "zanahoria": "carrot",
        "manzana": "apple",
        "patata": "potato",
        "boniato": "sweet potato",
        "pollo": "chicken",
        "huevo": "egg",
        "salmon": "salmon",
        "brocoli": "broccoli",
        "fresas": "strawberry",
        "yogur": "yogurt",
    }
    return tag_map.get(food_id, str(food_name))


def pick_openverse(query: str, tag: str, timeout: int) -> Optional[Dict[str, Any]]:
    # Allow commercial-safe licenses with attribution: cc0/pdm/by/by-sa
    page_size = OPENVERSE_ANON_MAX_PAGE_SIZE

    def fetch_results(use_tags: bool) -> List[Dict[str, Any]]:
        url = (
            f"{OPENVERSE}?q={quote(query)}"
            + (f"&tags={quote(tag)}" if (use_tags and tag) else "")
            + f"&license=cc0,pdm,by,by-sa"
            + f"&license_type=commercial"
            + f"&mature=false"
            + f"&page_size={page_size}"
        )
        data = http_get_json(url, timeout)
        results = data.get("results") or []
        if not isinstance(results, list):
            return []
        return [r for r in results if isinstance(r, dict) and r.get("url")]

    # Try with tags first (more precise). If Openverse returns no results, retry without tags.
    results = fetch_results(use_tags=True)
    if not results:
        results = fetch_results(use_tags=False)
    if not results:
        return None

    q_tokens = [tok for tok in re.split(r"\s+", query.lower()) if tok]
    tag_l = (tag or "").lower().strip()
    # Strong relevance guard: at least the main ingredient term should appear.
    # Use the last word of the tag (e.g., "potato" for "sweet potato").
    must_term = (tag_l.split()[-1] if tag_l else (q_tokens[0] if q_tokens else "")).strip()
    # Cut terms we care about; if present in query, prefer matching in title/tags
    cut_terms = {"slices", "slice", "sticks", "wedges", "cubes", "diced", "grated", "shredded", "puree", "mashed", "scrambled", "roasted", "steamed", "strips"}
    want_cut = [t for t in q_tokens if t in cut_terms]

    def score(item: Dict[str, Any]) -> int:
        s = 0
        title = str(item.get("title") or "").lower()
        tags = item.get("tags") or []
        tag_names = " ".join([str(t.get("name") or "").lower() for t in tags if isinstance(t, dict)])
        blob = title + " " + tag_names

        # Must look like it's actually about the ingredient
        if must_term and must_term not in blob:
            return -999

        for tok in q_tokens:
            if tok in blob:
                s += 2

        # Prefer matching the requested cut term(s)
        for ct in want_cut:
            if ct in blob:
                s += 3
        if "food" in blob:
            s += 1
        if "close" in blob or "closeup" in blob:
            s += 1
        return s

    ranked = sorted(results, key=score, reverse=True)
    return ranked[0] if ranked else None


def collect_local_refs(food_files: List[Path], root: Path) -> List[str]:
    refs: set[str] = set()
    for f in food_files:
        try:
            data = load_json(f)
        except Exception:
            continue
        m = data.get("imagen_alimento")
        if isinstance(m, str) and m and not is_http_url(m):
            refs.add(m.lstrip("./"))
        pres = data.get("presentaciones")
        if isinstance(pres, list):
            for p in pres:
                if not isinstance(p, dict):
                    continue
                u = p.get("imagen")
                if isinstance(u, str) and u and not is_http_url(u):
                    refs.add(u.lstrip("./"))
    return sorted(refs)


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--foods-dir", default="data/foods")
    ap.add_argument("--assets-dir", default="assets/images/foods")
    ap.add_argument("--attrib", default="data/images/image-attribution.json")
    ap.add_argument("--manifest", default="data/images/food-images.json")
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--include-missing", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--timeout", type=int, default=25)
    ap.add_argument("--sleep", type=float, default=0.2)
    args = ap.parse_args(argv)

    root = Path(__file__).resolve().parent.parent
    foods_dir = root / args.foods_dir
    assets_dir = root / args.assets_dir
    attrib_path = root / args.attrib
    manifest_path = root / args.manifest

    food_files = sorted(foods_dir.glob("*.json"))
    if args.only:
        only = set(args.only)
        food_files = [f for f in food_files if f.stem in only]

    attributions: List[Dict[str, Any]] = []
    rewritten = 0
    downloaded = 0
    errors = 0

    for food_file in food_files:
        data = load_json(food_file)
        food_id = str(data.get("id") or food_file.stem)
        food_name = str(data.get("nombre") or food_id)
        changed = False

        # main
        main_val = data.get("imagen_alimento")
        if (is_http_url(main_val) or (args.include_missing and main_val is None)):
            query = build_query(food_id, food_name, None)
            tag = ingredient_tag(food_id, food_name)
            item = pick_openverse(query, tag, args.timeout)
            if not item:
                print(f"[WARN] No Openverse result for {food_id} main (query: {query})")
            else:
                local = assets_dir / food_id / "main.jpg"
                rel = rel_from_root(root, local)
                if args.dry_run:
                    print(f"[DRY] {food_id} main <- {item.get('url')}")
                else:
                    try:
                        http_download(str(item.get("url")), local, args.timeout)
                        data["imagen_alimento"] = rel
                        changed = True
                        downloaded += 1
                        attributions.append(
                            {
                                "foodId": food_id,
                                "slot": "imagen_alimento",
                                "localPath": rel,
                                "openverse": {
                                    "id": item.get("id"),
                                    "title": item.get("title"),
                                    "url": item.get("url"),
                                    "foreign_landing_url": item.get("foreign_landing_url"),
                                    "license": item.get("license"),
                                    "creator": item.get("creator"),
                                    "creator_url": item.get("creator_url"),
                                    "source": item.get("source"),
                                },
                                "query": query,
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
                val = p.get("imagen")
                if not (is_http_url(val) or (args.include_missing and val is None)):
                    continue

                title = str(p.get("titulo") or f"#{i}")
                query = build_query(food_id, food_name, title)
                tag = ingredient_tag(food_id, food_name)
                item = pick_openverse(query, tag, args.timeout)
                if not item:
                    print(f"[WARN] No Openverse result for {food_id} p_{i:02d} ({title}) (query: {query})")
                    continue

                local = assets_dir / food_id / f"p_{i:02d}.jpg"
                rel = rel_from_root(root, local)
                if args.dry_run:
                    print(f"[DRY] {food_id} p_{i:02d} ({title}) <- {item.get('url')}")
                    continue

                try:
                    http_download(str(item.get("url")), local, args.timeout)
                    p["imagen"] = rel
                    changed = True
                    downloaded += 1
                    attributions.append(
                        {
                            "foodId": food_id,
                            "slot": f"presentaciones[{i}].imagen",
                            "title": title,
                            "localPath": rel,
                            "openverse": {
                                "id": item.get("id"),
                                "title": item.get("title"),
                                "url": item.get("url"),
                                "foreign_landing_url": item.get("foreign_landing_url"),
                                "license": item.get("license"),
                                "creator": item.get("creator"),
                                "creator_url": item.get("creator_url"),
                                "source": item.get("source"),
                            },
                            "query": query,
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

        # Regenerate manifest of local refs
        all_food_files = sorted((root / args.foods_dir).glob("*.json"))
        images = collect_local_refs(all_food_files, root)
        safe_mkdir(manifest_path.parent)
        with manifest_path.open("w", encoding="utf-8") as f:
            json.dump({"images": images}, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print("\n--- Summary ---")
    print(f"Food files scanned: {len(food_files)}")
    print(f"JSON files rewritten: {rewritten}")
    print(f"Images downloaded: {downloaded}")
    print(f"Errors: {errors}")
    if not args.dry_run:
        print(f"Attribution: {attrib_path.as_posix()}")
        print(f"Manifest: {manifest_path.as_posix()}")

    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
