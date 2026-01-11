#!/usr/bin/env python3
"""Download remote food images to local assets and rewrite JSON references.

- Scans data/foods/*.json
- Downloads imagen_alimento and presentaciones[].imagen when they are http(s)
- Stores into assets/images/foods/<food_id>/main.<ext> and p_<index>.<ext>
- Rewrites JSON to use local relative paths (forward slashes)
- Generates data/images/food-images.json with list of local image paths

Usage:
  python scripts/localize_food_images.py

Options:
  --dry-run        Don't download or modify JSON, just report.
  --force          Re-download even if file exists.
  --timeout 20     Network timeout seconds.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_UA = "BLWCareImageLocalizer/1.0 (+local dev)"


def apply_proxy(url: str, proxy: str) -> str:
    if not proxy:
        return url
    if proxy == "weserv":
        # Simple image proxy; useful to bypass transient 503s from some hosts.
        parsed = urlparse(url)
        host_path = (parsed.netloc or "") + (parsed.path or "")
        if parsed.query:
            host_path = host_path + "?" + parsed.query
        return f"https://images.weserv.nl/?url={quote(host_path, safe='')}&w=900"
    raise ValueError(f"Unknown proxy: {proxy}")


def is_http_url(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower().startswith(("http://", "https://"))


def guess_ext_from_content_type(content_type: str) -> str:
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct == "image/jpeg":
        return ".jpg"
    if ct == "image/png":
        return ".png"
    if ct == "image/webp":
        return ".webp"
    if ct == "image/gif":
        return ".gif"
    if ct == "image/svg+xml":
        return ".svg"
    return ".jpg"


def safe_mkdir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def normalize_rel_path(root: Path, p: Path) -> str:
    rel = p
    try:
        rel = p.resolve().relative_to(root.resolve())
    except Exception:
        # Fallback: best-effort relative string
        pass
    s = str(rel.as_posix())
    return s.lstrip("./")


ABS_WIN_RE = re.compile(r"^[A-Za-z]:[\\/]")


def maybe_rewrite_to_project_relative(root: Path, value: Any) -> Tuple[Any, bool]:
    if not isinstance(value, str):
        return value, False

    v = value.strip()
    if not v:
        return value, False

    # Keep URLs untouched here
    if v.lower().startswith(("http://", "https://")):
        return value, False

    # Convert Windows absolute paths pointing inside the repo to repo-relative
    if ABS_WIN_RE.match(v) or v.startswith("/"):
        candidate = Path(v.replace("/", os.sep))
        try:
            candidate_resolved = candidate.resolve()
            root_resolved = root.resolve()
            if str(candidate_resolved).lower().startswith(str(root_resolved).lower() + os.sep.lower()):
                rel = candidate_resolved.relative_to(root_resolved)
                return normalize_rel_path(root, rel), True
        except Exception:
            return value, False

    return value, False


def download(url: str, root: Path, dest: Path, timeout: int, user_agent: str, force: bool) -> Tuple[bool, Optional[str]]:
    if dest.exists() and not force:
        return False, None

    safe_mkdir(dest.parent)

    req = Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "image/*,*/*;q=0.8",
            "Referer": "https://unsplash.com/",
        },
    )

    # Basic retry/backoff for transient errors/rate limits
    for attempt in range(4):
        try:
            with urlopen(req, timeout=timeout) as resp:
                content_type = resp.headers.get("Content-Type", "")
                ext = guess_ext_from_content_type(content_type)

                # If destination has no suffix, append one
                final_dest = dest
                if final_dest.suffix == "":
                    final_dest = final_dest.with_suffix(ext)
                elif final_dest.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"):
                    final_dest = final_dest.with_suffix(ext)

                data = resp.read()
                with final_dest.open("wb") as f:
                    f.write(data)

            return True, normalize_rel_path(root, final_dest)

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

    return False, None


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--foods-dir", default="data/foods")
    parser.add_argument("--assets-dir", default="assets/images/foods")
    parser.add_argument("--manifest", default="data/images/food-images.json")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--proxy", choices=["", "weserv"], default="", help="Optional proxy for downloads (e.g. weserv)")
    parser.add_argument("--sleep", type=float, default=0.15, help="Sleep seconds between downloads")
    parser.add_argument("--user-agent", default=DEFAULT_UA)

    args = parser.parse_args(argv)

    root = Path(__file__).resolve().parent.parent
    foods_dir = (root / args.foods_dir).resolve()
    assets_dir = (root / args.assets_dir).resolve()
    manifest_path = (root / args.manifest).resolve()

    if not foods_dir.exists():
        print(f"ERROR: foods dir not found: {foods_dir}", file=sys.stderr)
        return 2

    food_files = sorted(foods_dir.glob("*.json"))
    if not food_files:
        print("No food json files found.")
        return 0

    downloaded: List[str] = []
    local_refs: set[str] = set()
    rewritten_files = 0
    download_count = 0
    skipped_count = 0
    error_count = 0

    for food_file in food_files:
        try:
            data = load_json(food_file)
        except Exception as e:
            print(f"[ERROR] invalid json: {food_file.name}: {e}")
            error_count += 1
            continue

        food_id = str(data.get("id") or food_file.stem)
        changed = False

        # Normalize existing local absolute paths (if any)
        data_val, did_change = maybe_rewrite_to_project_relative(root, data.get("imagen_alimento"))
        if did_change:
            data["imagen_alimento"] = data_val
            changed = True

        # Track already-local main image
        main_current = data.get("imagen_alimento")
        if isinstance(main_current, str) and not is_http_url(main_current) and main_current.strip():
            local_refs.add(main_current.strip().lstrip("./"))

        # Main image
        main_url = data.get("imagen_alimento")
        if is_http_url(main_url):
            dest_base = assets_dir / food_id / "main"
            if args.dry_run:
                print(f"[DRY] {food_file.name} imagen_alimento -> {dest_base}")
            else:
                try:
                    final_url = apply_proxy(str(main_url), args.proxy)
                    did, rel = download(final_url, root, dest_base, args.timeout, args.user_agent, args.force)
                    if rel:
                        data["imagen_alimento"] = rel
                        downloaded.append(rel)
                        local_refs.add(rel)
                        changed = True
                    if did:
                        download_count += 1
                        time.sleep(args.sleep)
                    else:
                        skipped_count += 1
                except Exception as e:
                    print(f"[ERROR] download imagen_alimento for {food_file.name}: {e}")
                    error_count += 1

        # Presentations
        pres = data.get("presentaciones")
        if isinstance(pres, list):
            for i, p in enumerate(pres):
                if not isinstance(p, dict):
                    continue

                # Normalize existing local absolute paths in presentation image
                p_val, p_changed = maybe_rewrite_to_project_relative(root, p.get("imagen"))
                if p_changed:
                    p["imagen"] = p_val
                    changed = True

                # Track already-local presentation image
                p_current = p.get("imagen")
                if isinstance(p_current, str) and not is_http_url(p_current) and p_current.strip():
                    local_refs.add(p_current.strip().lstrip("./"))

                url = p.get("imagen")
                if not is_http_url(url):
                    continue
                dest_base = assets_dir / food_id / f"p_{i:02d}"
                if args.dry_run:
                    title = p.get("titulo") or f"#{i}"
                    print(f"[DRY] {food_file.name} presentaciones[{i}] ({title}) -> {dest_base}")
                    continue
                try:
                    final_url = apply_proxy(str(url), args.proxy)
                    did, rel = download(final_url, root, dest_base, args.timeout, args.user_agent, args.force)
                    if rel:
                        p["imagen"] = rel
                        downloaded.append(rel)
                        local_refs.add(rel)
                        changed = True
                    if did:
                        download_count += 1
                        time.sleep(args.sleep)
                    else:
                        skipped_count += 1
                except Exception as e:
                    print(f"[ERROR] download presentaciones[{i}] for {food_file.name}: {e}")
                    error_count += 1

        if changed and not args.dry_run:
            try:
                dump_json(food_file, data)
                rewritten_files += 1
            except Exception as e:
                print(f"[ERROR] writing {food_file.name}: {e}")
                error_count += 1

    # Manifest (dedupe + keep stable)
    if not args.dry_run:
        safe_mkdir(manifest_path.parent)
        unique = sorted(local_refs)
        with manifest_path.open("w", encoding="utf-8") as f:
            json.dump({"images": unique}, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print("\n--- Summary ---")
    print(f"Food files scanned: {len(food_files)}")
    print(f"JSON files rewritten: {rewritten_files}")
    print(f"Downloads: {download_count}")
    print(f"Skipped (already existed): {skipped_count}")
    print(f"Errors: {error_count}")
    if not args.dry_run:
        print(f"Manifest: {os.path.relpath(manifest_path, root)}")

    return 0 if error_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
