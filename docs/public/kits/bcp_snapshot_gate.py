#!/usr/bin/env python3
"""MIT Engineering Kit: verify Playbook 03 snapshot evidence against expected stamps.

Usage: python bcp_snapshot_gate.py evidence.json --expected expected-stamps.json
Both inputs are JSON arrays; evidence rows come from bcp-failover-readiness-gate.kql.
Exit codes: 0 = snapshot parity, 1 = evidence failure, 2 = invalid input/configuration.
This checks B2 snapshot parity and B11 coverage, not the entire BCP readiness standard.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
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


def evaluate_evidence(raw: Any, expected: dict[tuple[str, str], str]) -> list[str]:
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
        self.manifest = [
            {"reqModel": "model-a", "stampRegion": region, "expectedSnapshot": "snapshot-a"}
            for region in ("eastus", "westus")
        ]
        self.expected = validate_expected(self.manifest)
        self.rows = [
            {"reqModel": row["reqModel"], "stampRegion": row["stampRegion"],
             "TotalCalls": 10, "SnapshotsObserved": ["snapshot-a"]}
            for row in self.manifest
        ]

    def test_pinned_parity_and_independent_models(self):
        self.assertEqual(evaluate_evidence(self.rows, self.expected), [])
        other = [dict(row, reqModel="model-b", expectedSnapshot="snapshot-b")
                 for row in self.manifest]
        rows = self.rows + [dict(row, reqModel="model-b", SnapshotsObserved=["snapshot-b"])
                            for row in self.rows]
        self.assertEqual(evaluate_evidence(rows, validate_expected(self.manifest + other)), [])

    def test_cross_region_and_within_stamp_drift(self):
        for snapshots in (["snapshot-b"], ["snapshot-a", "snapshot-b"]):
            rows = deepcopy(self.rows)
            rows[1]["SnapshotsObserved"] = snapshots
            with self.subTest(snapshots=snapshots):
                self.assertTrue(evaluate_evidence(rows, self.expected))
        # Matching each other is insufficient when both stamps drift from the pin.
        rows = [dict(row, SnapshotsObserved=["snapshot-b"]) for row in self.rows]
        self.assertEqual(len(evaluate_evidence(rows, self.expected)), 2)

    def test_missing_secondary_and_empty_evidence(self):
        for rows in (self.rows[:1], [], None, {}, [None]):
            with self.subTest(rows=rows):
                self.assertTrue(evaluate_evidence(rows, self.expected))

    def test_missing_or_malformed_telemetry(self):
        for field, values in {
            "SnapshotsObserved": [None, [], ["unreported"], "snapshot-a", [1], [None]],
            "TotalCalls": [None, 0, -1, True, 1.5, "10"],
            "stampRegion": [None, "", "unknown-region", " westus"],
            "reqModel": [None, "", 42],
        }.items():
            for value in values:
                rows = deepcopy(self.rows)
                rows[1][field] = value
                with self.subTest(field=field, value=value):
                    self.assertTrue(evaluate_evidence(rows, self.expected))
            rows = deepcopy(self.rows)
            del rows[1][field]
            self.assertTrue(evaluate_evidence(rows, self.expected))

    def test_duplicate_and_unexpected_stamps(self):
        for extra in (self.rows[0], dict(self.rows[0], stampRegion="northeurope"),
                      dict(self.rows[0], reqModel="model-b")):
            with self.subTest(extra=extra):
                self.assertTrue(evaluate_evidence(self.rows + [extra], self.expected))

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
            for content, code in ((json.dumps(self.rows), 0), ("[]", 1), ("{}", 1),
                                  ("{", 2), ("\ufffd", 2)):
                evidence.write_text(content, encoding="utf-8")
                result = subprocess.run(command, capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, code, result.stderr)
                self.assertEqual("PASSED" in result.stdout, code == 0)
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
    except (OSError, UnicodeError, ValueError) as error:
        print(f"BCP snapshot gate input error: {error}", file=sys.stderr)
        return 2
    failures = evaluate_evidence(raw, expected)
    if failures:
        print("BCP snapshot gate FAILED:\n" + "\n".join(failures), file=sys.stderr)
        return 1
    print(f"BCP snapshot gate PASSED ({len(expected)} expected model/region stamps; snapshot parity only).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
