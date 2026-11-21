"""Build the public, read-only plant-name index from the World Flora Online Darwin Core archive."""
import argparse
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import sqlite3
import tempfile
import unicodedata
import zipfile


ROOT = Path(__file__).resolve().parents[1] / "apps/plant-id/knowledge"
WFO_RELEASE = "2026-06"
WFO_SOURCE = "https://doi.org/10.5281/zenodo.20782718"
WFO_MD5 = "0e4486945cd9f7af548ca87eb9a870ed"
RANKS = {"species", "genus", "family"}


def key(name):
    return " ".join(unicodedata.normalize("NFKC", name).lower().split())


def wfo_number(raw):
    return int(raw[4:]) if re.fullmatch(r"wfo-[0-9]{10}", raw) else None


def populate(archive, database):
    database.executescript("""
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        CREATE TABLE taxa (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, rank TEXT NOT NULL,
            family TEXT NOT NULL, genus TEXT NOT NULL, plant_group TEXT NOT NULL
        );
        CREATE TABLE names (
            name TEXT NOT NULL, id INTEGER NOT NULL, synonym INTEGER NOT NULL,
            PRIMARY KEY(name, id)
        ) WITHOUT ROWID;
        CREATE TEMP TABLE incoming (name TEXT, target INTEGER);
    """)
    accepted, names, synonyms = [], [], []

    def flush():
        database.executemany("INSERT INTO taxa VALUES (?,?,?,?,?,?)", accepted)
        database.executemany("INSERT OR IGNORE INTO names VALUES (?,?,0)", names)
        database.executemany("INSERT INTO incoming VALUES (?,?)", synonyms)
        accepted.clear()
        names.clear()
        synonyms.clear()

    with zipfile.ZipFile(archive) as package, package.open("classification.csv") as stream:
        rows = csv.reader(io.TextIOWrapper(stream, encoding="utf-8-sig", errors="replace", newline=""), delimiter="\t")
        headers = next(rows)
        columns = [headers.index(name) for name in (
            "taxonID", "scientificName", "taxonRank", "family", "genus", "majorGroup",
            "taxonomicStatus", "acceptedNameUsageID"
        )]
        for row in rows:
            if not row:
                continue
            raw_id, name, rank, family, genus, plant_group, status, target = (row[i] for i in columns)
            name, rank = name.strip(), rank.lower()
            if rank not in RANKS or not name or len(name) > 240 or "\ufffd" in name:
                continue
            if status.lower() == "accepted" and (taxon_id := wfo_number(raw_id)):
                accepted.append((taxon_id, name, rank, family, genus, plant_group))
                names.append((key(name), taxon_id))
            elif status.lower() == "synonym" and (target_id := wfo_number(target)):
                synonyms.append((key(name), target_id))
            if len(accepted) + len(synonyms) >= 5000:
                flush()
        flush()
    database.execute("""
        INSERT OR IGNORE INTO names
        SELECT incoming.name, incoming.target, 1
        FROM incoming JOIN taxa ON taxa.id = incoming.target
    """)
    database.commit()
    stats = dict(database.execute("SELECT rank, count(*) FROM taxa GROUP BY rank"))
    stats["synonymNameLinks"] = database.execute("SELECT count(*) FROM names WHERE synonym=1").fetchone()[0]
    if stats.get("species", 0) < 300000 or stats.get("genus", 0) < 10000 or stats["synonymNameLinks"] < 100000:
        raise ValueError(f"World Flora capture is incomplete: {stats}")
    if database.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("World Flora index integrity check failed")
    database.execute("VACUUM")
    return stats


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    with args.archive.open("rb") as source:
        if hashlib.file_digest(source, "md5").hexdigest() != WFO_MD5:
            raise SystemExit("The input archive does not match the pinned WFO release checksum")
    with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
        temp = Path(temporary)
        database_path = temp / "world-flora.sqlite"
        database = sqlite3.connect(database_path)
        try:
            stats = populate(args.archive, database)
        finally:
            database.close()
        packed = temp / "world-flora.sqlite.gz"
        with database_path.open("rb") as src, packed.open("wb") as dst:
            with gzip.GzipFile(filename="", mode="wb", fileobj=dst, mtime=0) as compressed:
                shutil.copyfileobj(src, compressed, length=1024 * 1024)
        with database_path.open("rb") as source:
            checksum = hashlib.file_digest(source, "sha256").hexdigest()
        metadata = {"release": WFO_RELEASE, "source": WFO_SOURCE,
                    "license": "https://creativecommons.org/publicdomain/zero/1.0/",
                    "stats": stats, "sha256": checksum}
        manifest = temp / "world-flora.json"
        manifest.write_text(json.dumps(metadata, indent=2) + "\n")
        packed.replace(ROOT / packed.name)
        manifest.replace(ROOT / manifest.name)
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
