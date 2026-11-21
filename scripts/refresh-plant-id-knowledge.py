"""Refresh the independent Plant ID catalogue using public GBIF records."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import timezone, datetime
import json
from pathlib import Path
import re
import time
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1] / "apps/plant-id/knowledge"
API = "https://api.gbif.org/v1"
BACKBONE = "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c"
COMMUNITIES = {
    "iNaturalist": "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
    "Pl@ntNet": "7a3679ef-5582-4aaa-81f0-8c2545cafc81",
}
OPEN_LICENSES = re.compile(r"^https?://creativecommons\.org/(?:publicdomain/zero/1\.0|licenses/by(?:-sa)?/4\.0)/?(?:legalcode)?$")


def get(path, **params):
    query = "?" + urlencode(params) if params else ""
    request = Request(API + path + query, headers={"User-Agent": "LeafArchive plant-ID knowledge refresh (gloriouscarnivorousplants.top)"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=15) as response:
                if urlparse(response.geturl()).hostname != "api.gbif.org":
                    raise ValueError("unexpected GBIF response host")
                data = response.read(4 * 1024 * 1024 + 1)
                if len(data) > 4 * 1024 * 1024:
                    raise ValueError("GBIF response exceeds the import limit")
                return json.loads(data)
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except OSError:
            if attempt == 2:
                raise
        time.sleep(1 + attempt * 2)


def taxon(row):
    return {
        "id": row["key"],
        "name": row["canonicalName"],
        "rank": row["rank"].lower(),
        "genus": row.get("genus", row["canonicalName"]),
        "family": row.get("family", ""),
        "order": row.get("order", ""),
    }


def genus_records(name):
    match = get("/species/match", name=name, rank="GENUS", kingdom="Plantae", strict="true")
    if match.get("matchType") != "EXACT" or match.get("status") != "ACCEPTED" or match.get("canonicalName") != name:
        raise ValueError(f"GBIF did not accept genus {name}")
    root = get(f"/species/{match['usageKey']}")
    if root.get("datasetKey") != BACKBONE or root.get("rank") != "GENUS":
        raise ValueError(f"GBIF returned the wrong genus for {name}")
    accepted = [taxon(root)]
    aliases = {}
    for offset in range(0, 2000, 200):
        page = get(f"/species/{root['key']}/children", limit=200, offset=offset)
        for row in page["results"]:
            if row.get("rank") != "SPECIES" or not row.get("canonicalName") or row.get("kingdom") != "Plantae":
                continue
            if row.get("taxonomicStatus") == "ACCEPTED":
                accepted.append(taxon(row))
            elif row.get("taxonomicStatus") == "SYNONYM" and row.get("acceptedKey"):
                aliases[row["canonicalName"]] = row["acceptedKey"]
        if page["endOfRecords"]:
            return accepted, aliases
    raise ValueError(f"GBIF import exceeded the page limit for {name}")


def species_aliases(row):
    aliases = []
    for offset in range(0, 300, 100):
        page = get(f"/species/{row['id']}/synonyms", limit=100, offset=offset)
        aliases.extend((entry["canonicalName"], row["id"]) for entry in page["results"]
                       if entry.get("rank") == "SPECIES" and entry.get("taxonomicStatus") == "SYNONYM"
                       and entry.get("acceptedKey") == row["id"] and entry.get("canonicalName"))
        if page["endOfRecords"]:
            return aliases
    raise ValueError(f"GBIF synonyms exceeded the page limit for {row['name']}")


def community_rows(job):
    row, platform, dataset = job
    try:
        records = get("/occurrence/search", datasetKey=dataset, taxonKey=row["id"], mediaType="StillImage", license="CC_BY_4_0", limit=4)
    except OSError as error:
        print(f"Skipped {platform} / {row['name']}: {type(error).__name__}", file=sys.stderr, flush=True)
        return None
    for entry in records["results"]:
        license_url = entry.get("license", "")
        if (entry.get("occurrenceStatus") not in ("PRESENT", "DETECTED") or entry.get("datasetKey") != dataset or entry.get("speciesKey") != row["id"]
                or not isinstance(entry.get("key"), int) or not OPEN_LICENSES.fullmatch(license_url or "")):
            continue
        # Retain only normalized observation metadata and a source link.
        # Media have their own licenses and are not copied by this importer.
        return {"taxonId": row["id"], "platform": platform, "id": entry["key"], "license": license_url}
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "snapshot.json")
    args = parser.parse_args()
    seed = json.loads((ROOT / "seed.json").read_text())
    with ThreadPoolExecutor(max_workers=4) as pool:
        groups = list(pool.map(genus_records, seed["genera"]))
        taxa = [row for group, _ in groups for row in group]
        ids = {row["id"] for row in taxa}
        by_name = {row["name"]: row for row in taxa}
        examples = [by_name[name] for name in seed["communityExamples"] if name in by_name]
        aliases_by_name = {}
        for pairs in [group.items() for _, group in groups] + list(pool.map(species_aliases, examples)):
            for name, key in pairs:
                if key in ids and name not in by_name:
                    aliases_by_name.setdefault(name, set()).add(key)
        aliases = {name: next(iter(keys)) for name, keys in aliases_by_name.items() if len(keys) == 1}
        jobs = [(row, platform, dataset) for row in examples for platform, dataset in COMMUNITIES.items()]
        print(f"Fetched {len(taxa)} accepted taxa and {len(aliases)} synonyms; checking {len(jobs)} community lookups", flush=True)
        observations = [row for row in pool.map(community_rows, jobs) if row]
    if len(taxa) < 400 or {row["platform"] for row in observations} != set(COMMUNITIES):
        raise ValueError("import appears incomplete; existing snapshot was preserved")
    snapshot = {
        "date": datetime.now(timezone.utc).date().isoformat(),
        "backbone": BACKBONE,
        "communities": COMMUNITIES,
        "taxa": sorted(taxa, key=lambda row: (row["name"], row["id"])),
        "aliases": dict(sorted(aliases.items())),
        "observations": sorted(observations, key=lambda row: (row["taxonId"], row["platform"])),
    }
    temp = args.output.with_suffix(".tmp")
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n")
    temp.replace(args.output)
    print(f"{len(taxa)} accepted taxa, {len(aliases)} aliases, {len(observations)} community examples")


if __name__ == "__main__":
    main()
