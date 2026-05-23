#!/usr/bin/env python3
"""Scan Chatwoot CE tree for rebrand inventory (Prompt 3 discovery)."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CW = ROOT / ".upstream-inventory" / "chatwoot"
OUT = ROOT / "docs" / "blinkone" / "REBRAND_INVENTORY.json"

SKIP_DIRS = {"node_modules", "vendor", ".git", "tmp", "log", "coverage", "enterprise"}
PATTERN = re.compile(r"Chatwoot|chatwoot\.com|chatwoot\.help|CHATWOOT", re.I)
LOGO_PATTERN = re.compile(
    r"(logo|favicon|brand|woot).*\.(svg|png|ico|jpg)|/brand/|brand-assets",
    re.I,
)
POWERED = re.compile(r"powered\s+by", re.I)


def should_skip(p: Path) -> bool:
    return any(part in SKIP_DIRS for part in p.parts)


def scan_file(path: Path) -> list[dict]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    rows = []
    rel = path.relative_to(CW).as_posix()
    for i, line in enumerate(text.splitlines(), 1):
        if PATTERN.search(line):
            rows.append({"file": rel, "line": i, "text": line.strip()[:200]})
    return rows


def main() -> None:
    if not CW.is_dir():
        raise SystemExit(f"Clone Chatwoot first: {CW}")

    all_rows: list[dict] = []
    by_category: dict[str, list[dict]] = defaultdict(list)

    def cat_for(rel: str) -> str:
        if "/dashboard/i18n/" in rel:
            return "1_dashboard_i18n"
        if "/widget/i18n/" in rel:
            return "2_widget_i18n"
        if "/portal/" in rel and rel.endswith(".json"):
            return "3_portal_i18n"
        if rel.startswith("app/views/mailers/") or rel.startswith("app/views/devise/"):
            return "4_email"
        if rel in ("public/manifest.json", "public/browserconfig.xml") or "index.html" in rel:
            return "5_html_metadata"
        if rel.startswith("public/") and rel.endswith((".html", ".ico", ".png", ".svg", ".xml", ".json")):
            return "5_html_metadata"
        if "layouts/application" in rel:
            return "6_loading_layout"
        if rel == "config/installation_config.yml":
            return "8_installation_config"
        if "Signup" in rel or "signup" in rel.lower():
            return "9_onboarding"
        if "slack" in rel.lower() and ("user_agent" in rel.lower() or "user-agent" in rel.lower()):
            return "10_webhook_ua"
        if LOGO_PATTERN.search(rel):
            return "7_logo_assets"
        if "chatwoot.com" in rel or POWERED.search(rel):
            return "11_marketing_links"
        if rel.startswith("public/4"):
            return "12_error_pages"
        return "99_other"

    for path in CW.rglob("*"):
        if not path.is_file() or should_skip(path):
            continue
        if path.suffix.lower() not in {
            ".json", ".yml", ".yaml", ".erb", ".html", ".liquid", ".vue", ".js",
            ".rb", ".scss", ".xml", ".md", ".txt", ".ico",
        }:
            continue
        for row in scan_file(path):
            all_rows.append(row)
            by_category[cat_for(row["file"])].append(row)

    # i18n aggregates
    i18n_counts: dict[str, int] = defaultdict(int)
    for row in by_category["1_dashboard_i18n"]:
        loc = row["file"].split("/locale/")[1].split("/")[0] if "/locale/" in row["file"] else "?"
        i18n_counts[f"dashboard/{loc}"] += 1

    en_samples = [r for r in by_category["1_dashboard_i18n"] if "/locale/en/" in r["file"]][:40]

    summary = {
        "upstream_tag": "v4.13.0",
        "total_matches": len(all_rows),
        "by_category_counts": {k: len(v) for k, v in sorted(by_category.items())},
        "dashboard_i18n_locale_counts": dict(sorted(i18n_counts.items(), key=lambda x: -x[1])[:60]),
        "en_dashboard_samples": en_samples,
        "widget_i18n_files": len(by_category["2_widget_i18n"]),
        "installation_config": by_category["8_installation_config"],
        "email_samples": by_category["4_email"][:25],
        "metadata": by_category["5_html_metadata"],
        "marketing_samples": [r for r in all_rows if "chatwoot.com" in r["text"].lower()][:30],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({len(all_rows)} matches)")


if __name__ == "__main__":
    main()
