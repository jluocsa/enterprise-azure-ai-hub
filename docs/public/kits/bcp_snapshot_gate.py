#!/usr/bin/env python3
"""MIT Engineering Kit: verify Playbook 03 snapshot evidence against expected stamps.

Usage: python bcp_snapshot_gate.py evidence.json --expected expected-stamps.json
Both inputs are JSON arrays; evidence rows come from bcp-failover-readiness-gate.kql.
Exit codes: 0 = fresh snapshot parity, 1 = evidence failure, 2 = invalid input/configuration.
LastSeen and LastSuccessfulSeen must be timezone-aware and no older than
--max-age-minutes (default: 15). SuccessfulCalls must be positive (HTTP 2xx).
This checks B2 snapshot parity and B11 coverage, not the entire BCP readiness standard.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from typing import Any
import unittest


def identifier(row: dict[str, Any], field: str) -> str:
    value = row.get(field)
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a non-empty string without surrounding whitespace")
    if value in ("unknown-region", "unreported"):
        raise ValueError(f"{field} must be reported explicitly")
    return value


def validate_expected(raw: Any) -> dict[tuple[str, str], str]:
    if not isinstance(raw, list) or not raw:
        raise ValueError("expected stamps must be a non-empty JSON array")
    expected: dict[tuple[str, str], str] = {}
    model_snapshots: dict[str, set[str]] = {}
    model_regions: dict[str, set[str]] = {}
    for index, row in enumerate(raw, 1):
        if not isinstance(row, dict):
            raise ValueError(f"expected row-{index} must be an object")
        try:
            model = identifier(row, "reqModel")
            region = identifier(row, "stampRegion")
            snapshot = identifier(row, "expectedSnapshot")
        except ValueError as error:
            raise ValueError(f"expected row-{index}: {error}") from error
        key = (model, region)
        if key in expected:
            raise ValueError(f"expected row-{index}: duplicate model/region")
        expected[key] = snapshot
        model_snapshots.setdefault(model, set()).add(snapshot)
        model_regions.setdefault(model, set()).add(region)
    if any(len(snapshots) != 1 for snapshots in model_snapshots.values()):
        raise ValueError("expectedSnapshot must match across regions for each reqModel")
    if any(len(regions) < 2 for regions in model_regions.values()):
        raise ValueError("each reqModel must declare at least two distinct regions")
    return expected


def evaluate_evidence(
    raw: Any, expected: dict[tuple[str, str], str], *,
    max_age_minutes: int = 15, now: datetime | None = None,
) -> list[str]:
    if type(max_age_minutes) is not int or max_age_minutes <= 0:
        raise ValueError("max-age-minutes must be a positive integer")
    now = now if now is not None else datetime.now(timezone.utc)
    if not isinstance(raw, list):
        return ["evidence must be a JSON array of KQL result objects"]
    failures: list[str] = []
    seen: set[tuple[str, str]] = set()
    for index, row in enumerate(raw, 1):
        prefix = f"evidence row-{index}:"
        if not isinstance(row, dict):
            failures.append(f"{prefix} must be an object")
            continue
        try:
            key = (identifier(row, "reqModel"), identifier(row, "stampRegion"))
        except ValueError as error:
            failures.append(f"{prefix} {error}")
            continue
        if key in seen:
            failures.append(f"{prefix} duplicate model/region")
        seen.add(key)
        if key not in expected:
            failures.append(f"{prefix} unexpected model/region")
        if type(row.get("TotalCalls")) is not int or row["TotalCalls"] <= 0:
            failures.append(f"{prefix} TotalCalls must be a positive integer")
        if type(row.get("SuccessfulCalls")) is not int or row["SuccessfulCalls"] <= 0:
            failures.append(f"{prefix} SuccessfulCalls must be a positive integer")
        elif type(row.get("TotalCalls")) is int and row["SuccessfulCalls"] > row["TotalCalls"]:
            failures.append(f"{prefix} SuccessfulCalls must not exceed TotalCalls")
        for field in ("LastSeen", "LastSuccessfulSeen"):
            try:
                last_seen = datetime.fromisoformat(identifier(row, field).replace("Z", "+00:00"))
                if last_seen.utcoffset() is None:
                    raise ValueError("timezone required")
                age_seconds = (now - last_seen).total_seconds()
            except (ValueError, OverflowError):
                failures.append(f"{prefix} {field} must be an ISO 8601 timestamp with an explicit timezone")
            else:
                if age_seconds < 0:
                    failures.append(f"{prefix} {field} must not be in the future")
                elif age_seconds > max_age_minutes * 60:
                    failures.append(f"{prefix} {field} exceeds the {max_age_minutes}-minute freshness limit")
        snapshots = row.get("SnapshotsObserved")
        if (
            not isinstance(snapshots, list)
            or len(snapshots) != 1
            or not isinstance(snapshots[0], str)
            or snapshots[0] != expected.get(key)
        ):
            failures.append(f"{prefix} SnapshotsObserved must contain only the pinned expected snapshot")
    for index, key in enumerate(expected, 1):
        if key not in seen:
            failures.append(f"expected row-{index}: missing stamp evidence")
    return failures


class SnapshotGateTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)
        self.manifest = [
            {"reqModel": "model-a", "stampRegion": region, "expectedSnapshot": "snapshot-a"}
            for region in ("eastus", "westus")
        ]
        self.expected = validate_expected(self.manifest)
        self.rows = [
            {"reqModel": row["reqModel"], "stampRegion": row["stampRegion"],
             "TotalCalls": 10, "SnapshotsObserved": ["snapshot-a"],
             "LastSeen": (self.now - timedelta(minutes=1)).isoformat(),
             "SuccessfulCalls": 8,
             "LastSuccessfulSeen": (self.now - timedelta(minutes=2)).isoformat()}
            for row in self.manifest
        ]

    def test_pinned_parity_and_independent_models(self):
        self.assertEqual(evaluate_evidence(self.rows, self.expected, now=self.now), [])
        other = [dict(row, reqModel="model-b", expectedSnapshot="snapshot-b")
                 for row in self.manifest]
        rows = self.rows + [dict(row, reqModel="model-b", SnapshotsObserved=["snapshot-b"])
                            for row in self.rows]
        self.assertEqual(evaluate_evidence(rows, validate_expected(self.manifest + other), now=self.now), [])

    def test_cross_region_and_within_stamp_drift(self):
        for snapshots in (["snapshot-b"], ["snapshot-a", "snapshot-b"]):
            rows = deepcopy(self.rows)
            rows[1]["SnapshotsObserved"] = snapshots
            with self.subTest(snapshots=snapshots):
                self.assertTrue(evaluate_evidence(rows, self.expected, now=self.now))
        # Matching each other is insufficient when both stamps drift from the pin.
        rows = [dict(row, SnapshotsObserved=["snapshot-b"]) for row in self.rows]
        self.assertEqual(len(evaluate_evidence(rows, self.expected, now=self.now)), 2)

    def test_missing_secondary_and_empty_evidence(self):
        for rows in (self.rows[:1], [], None, {}, [None]):
            with self.subTest(rows=rows):
                self.assertTrue(evaluate_evidence(rows, self.expected, now=self.now))

    def test_missing_or_malformed_telemetry(self):
        for field, values in {
            "SnapshotsObserved": [None, [], ["unreported"], "snapshot-a", [1], [None]],
            "TotalCalls": [None, 0, -1, True, 1.5, "10"],
            "SuccessfulCalls": [None, 0, -1, True, 1.5, "8", 11, [], {}],
            "stampRegion": [None, "", "unknown-region", " westus"],
            "reqModel": [None, "", 42],
            "LastSeen": [None, "", 42, True, [], {}, "not-a-time",
                         "2026-11-20", "2026-11-20T11:59:00",
                         "2026-11-20T11:59:00Z ", "2026-13-20T11:59:00Z"],
            "LastSuccessfulSeen": [None, "", 42, True, [], {}, "not-a-time",
                                   "2026-11-20", "2026-11-20T11:59:00",
                                   "2026-11-20T11:59:00Z ", "2026-13-20T11:59:00Z"],
        }.items():
            for value in values:
                rows = deepcopy(self.rows)
                rows[1][field] = value
                with self.subTest(field=field, value=value):
                    self.assertTrue(evaluate_evidence(rows, self.expected, now=self.now))
            rows = deepcopy(self.rows)
            del rows[1][field]
            self.assertTrue(evaluate_evidence(rows, self.expected, now=self.now))

    def test_freshness_boundaries_and_timezones(self):
        for timestamp in ("2026-11-20T11:45:00Z", "2026-11-20T12:00:00+00:00",
                          "2026-11-20T13:45:00+02:00", "2026-11-20T06:45:00-05:00"):
            rows = [dict(row, LastSeen=timestamp) for row in self.rows]
            with self.subTest(timestamp=timestamp):
                self.assertEqual(evaluate_evidence(rows, self.expected, now=self.now), [])
        for timestamp, message in (
            ("2026-11-20T11:44:59.999999Z", "freshness limit"),
            ("2026-11-20T12:00:00.000001Z", "future"),
            ("2026-11-19T11:59:00Z", "freshness limit"),
        ):
            rows = deepcopy(self.rows)
            rows[1]["LastSeen"] = timestamp
            with self.subTest(timestamp=timestamp):
                failures = evaluate_evidence(rows, self.expected, now=self.now)
                self.assertEqual(len(failures), 1)
                self.assertIn("evidence row-2: LastSeen", failures[0])
                self.assertIn(message, failures[0])

    def test_configurable_freshness_limit(self):
        rows = [dict(row, LastSeen="2026-11-20T11:30:00Z") for row in self.rows]
        self.assertTrue(evaluate_evidence(rows, self.expected, now=self.now))
        self.assertEqual(
            evaluate_evidence(rows, self.expected, now=self.now, max_age_minutes=30), [],
        )
        for limit in (0, -1, True, 1.5, "15", None):
            with self.subTest(limit=limit), self.assertRaises(ValueError):
                evaluate_evidence(rows, self.expected, now=self.now, max_age_minutes=limit)

    def test_recent_failures_cannot_refresh_successful_evidence(self):
        for timestamp, diagnostic in (
            (None, "explicit timezone"),
            ("2026-11-20T11:44:59.999999Z", "freshness limit"),
            ("2026-11-20T12:00:00.000001Z", "future"),
        ):
            rows = deepcopy(self.rows)
            rows[1]["LastSeen"] = self.now.isoformat()
            rows[1]["LastSuccessfulSeen"] = timestamp
            with self.subTest(timestamp=timestamp):
                failures = evaluate_evidence(rows, self.expected, now=self.now)
                self.assertEqual(len(failures), 1)
                self.assertIn("evidence row-2: LastSuccessfulSeen", failures[0])
                self.assertIn(diagnostic, failures[0])
        for timestamp in ("2026-11-20T11:45:00Z", "2026-11-20T13:45:00+02:00"):
            rows = [dict(row, SuccessfulCalls=1, LastSuccessfulSeen=timestamp) for row in self.rows]
            self.assertEqual(evaluate_evidence(rows, self.expected, now=self.now), [])
        rows = [dict(row, LastSuccessfulSeen="2026-11-20T11:30:00Z") for row in self.rows]
        self.assertEqual(evaluate_evidence(rows, self.expected, now=self.now, max_age_minutes=30), [])

    def test_duplicate_and_unexpected_stamps(self):
        for extra in (self.rows[0], dict(self.rows[0], stampRegion="northeurope"),
                      dict(self.rows[0], reqModel="model-b")):
            with self.subTest(extra=extra):
                self.assertTrue(evaluate_evidence(self.rows + [extra], self.expected, now=self.now))

    def test_invalid_manifests(self):
        for manifest in (
            None, {}, [], [None], self.manifest[:1],
            self.manifest + [self.manifest[0]],
            [dict(row, expectedSnapshot="snapshot-" + str(i))
             for i, row in enumerate(self.manifest)],
            [dict(row, expectedSnapshot="unreported") for row in self.manifest],
            [dict(row, stampRegion="unknown-region") for row in self.manifest],
            [dict(row, expectedSnapshot=None) for row in self.manifest],
        ):
            with self.subTest(manifest=manifest), self.assertRaises(ValueError):
                validate_expected(manifest)

    def test_cli_exit_codes_and_file_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "expected.json"
            evidence = Path(directory) / "evidence.json"
            manifest.write_text(json.dumps(self.manifest), encoding="utf-8")
            command = [sys.executable, str(Path(__file__).resolve()), str(evidence),
                       "--expected", str(manifest)]
            fresh_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            fresh_rows = [dict(row, LastSeen=fresh_time, LastSuccessfulSeen=fresh_time)
                          for row in self.rows]
            for content, code in ((json.dumps(fresh_rows), 0), ("[]", 1), ("{}", 1),
                                  ("{", 2), ("\ufffd", 2)):
                evidence.write_text(content, encoding="utf-8")
                result = subprocess.run(command, capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, code, result.stderr)
                self.assertEqual("PASSED" in result.stdout, code == 0)
            stale_rows = [dict(row, LastSeen=(datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat())
                          for row in fresh_rows]
            evidence.write_text(json.dumps(stale_rows), encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 1)
            self.assertIn("freshness limit", result.stderr)
            self.assertNotIn("PASSED", result.stdout)
            result = subprocess.run(command + ["--max-age-minutes", "60"],
                                    capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            for field, value, diagnostic in (
                ("SuccessfulCalls", None, "positive integer"),
                ("SuccessfulCalls", 0, "positive integer"),
                ("SuccessfulCalls", True, "positive integer"),
                ("SuccessfulCalls", 11, "must not exceed TotalCalls"),
                ("LastSuccessfulSeen", None, "explicit timezone"),
                ("LastSuccessfulSeen",
                 (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat(),
                 "freshness limit"),
                ("LastSuccessfulSeen",
                 (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(), "future"),
            ):
                rows = deepcopy(fresh_rows)
                rows[1][field] = value
                evidence.write_text(json.dumps(rows), encoding="utf-8")
                result = subprocess.run(command, capture_output=True, text=True, check=False)
                with self.subTest(field=field, value=value):
                    self.assertEqual(result.returncode, 1)
                    self.assertIn(f"evidence row-2: {field}", result.stderr)
                    self.assertIn(diagnostic, result.stderr)
                    self.assertNotIn("Traceback", result.stderr)
                    self.assertEqual(result.stdout, "")
            for timestamp, diagnostic in (
                (None, "explicit timezone"),
                ("not-a-time", "explicit timezone"),
                ("2026-11-20T11:59:00", "explicit timezone"),
                ((datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(), "future"),
            ):
                rows = deepcopy(fresh_rows)
                rows[1]["LastSeen"] = timestamp
                evidence.write_text(json.dumps(rows), encoding="utf-8")
                result = subprocess.run(command, capture_output=True, text=True, check=False)
                with self.subTest(timestamp=timestamp):
                    self.assertEqual(result.returncode, 1)
                    self.assertIn("evidence row-2: LastSeen", result.stderr)
                    self.assertIn(diagnostic, result.stderr)
                    self.assertNotIn("Traceback", result.stderr)
                    self.assertNotIn("PASSED", result.stdout)
            for value in ("0", "-1", "1.5", "NaN"):
                result = subprocess.run(command + ["--max-age-minutes", value],
                                        capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn("PASSED", result.stdout)
            evidence.write_bytes(b"\xff")
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 2)
            evidence.unlink()
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 2)
            manifest.write_text("[]", encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 2)
            self.assertIn("expected stamps", result.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", nargs="?", type=Path)
    parser.add_argument("--expected", type=Path)
    parser.add_argument("--max-age-minutes", type=int, default=15,
                        help="maximum age of each stamp's LastSeen timestamp (default: 15)")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(SnapshotGateTests)
        return 0 if unittest.TextTestRunner().run(suite).wasSuccessful() else 1
    if args.evidence is None or args.expected is None:
        parser.error("evidence and --expected are required")
    try:
        expected = validate_expected(json.loads(args.expected.read_text(encoding="utf-8")))
        raw = json.loads(args.evidence.read_text(encoding="utf-8"))
        failures = evaluate_evidence(raw, expected, max_age_minutes=args.max_age_minutes)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"BCP snapshot gate input error: {error}", file=sys.stderr)
        return 2
    if failures:
        print("BCP snapshot gate FAILED:\n" + "\n".join(failures), file=sys.stderr)
        return 1
    print(f"BCP snapshot gate PASSED ({len(expected)} expected model/region stamps; "
          f"snapshot parity with successful evidence age <= {args.max_age_minutes} minutes only).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
