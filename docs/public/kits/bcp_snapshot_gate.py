#!/usr/bin/env python3
"""MIT Engineering Kit: verify Playbook 03 snapshot evidence against expected stamps.

Usage: python bcp_snapshot_gate.py evidence.json --expected expected-stamps.json
Both inputs are JSON arrays; evidence rows come from bcp-failover-readiness-gate.kql.
Expected rows allow only reqModel, stampRegion, expectedSnapshot, and optional metadata.
Unsupported manifest fields exit 2 before evidence is read; metadata is not enforced.
Every JSON object must have unique member names, including nested metadata.
Non-standard JSON numeric constants (NaN, Infinity, -Infinity) are rejected.
Region identity is case-insensitive; model and snapshot identities remain exact.
JSON parser nesting failures produce an input error, not a traceback.
Exit codes: 0 = fresh snapshot parity, 1 = evidence failure, 2 = invalid input/configuration.
LastSeen and LastSuccessfulSeen must be timezone-aware and no older than
--max-age-minutes (default: 15). SuccessfulCalls must be positive (HTTP 2xx).
LastSuccessfulSeen must not be later than LastSeen for the same stamp.
When all calls succeeded, LastSuccessfulSeen must equal LastSeen.
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


def unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    obj: dict[str, Any] = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError("duplicate JSON object members are not allowed.")
        obj[key] = value
    return obj


def reject_json_constant(value: str) -> Any:
    raise ValueError("non-standard JSON numeric constants are not allowed.")


def load_json(path: Path) -> Any:
    content = path.read_text(encoding="utf-8")
    try:
        return json.loads(
            content, object_pairs_hook=unique_json_object, parse_constant=reject_json_constant,
        )
    except RecursionError:
        raise ValueError("JSON exceeds the parser nesting limit.") from None


def identifier(row: dict[str, Any], field: str) -> str:
    value = row.get(field)
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a non-empty string without surrounding whitespace")
    if field == "stampRegion":
        value = value.lower()
    if value in ("unknown-region", "unreported"):
        raise ValueError(f"{field} must be reported explicitly")
    return value


def validate_expected(raw: Any) -> dict[tuple[str, str], str]:
    if not isinstance(raw, list) or not raw:
        raise ValueError("expected stamps must be a non-empty JSON array")
    allowed_fields = ("reqModel", "stampRegion", "expectedSnapshot", "metadata")
    expected: dict[tuple[str, str], str] = {}
    model_snapshots: dict[str, set[str]] = {}
    model_regions: dict[str, set[str]] = {}
    for index, row in enumerate(raw, 1):
        if not isinstance(row, dict):
            raise ValueError(f"expected row-{index} must be an object")
        if any(field not in allowed_fields for field in row):
            raise ValueError(
                f"expected row-{index}: unsupported fields; allowed fields: "
                + ", ".join(allowed_fields)
            )
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
        fresh_timestamps: dict[str, datetime] = {}
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
                else:
                    fresh_timestamps[field] = last_seen
        if (
            len(fresh_timestamps) == 2
            and fresh_timestamps["LastSuccessfulSeen"] > fresh_timestamps["LastSeen"]
        ):
            failures.append(f"{prefix} LastSuccessfulSeen must not exceed LastSeen")
        elif (
            len(fresh_timestamps) == 2
            and type(row.get("TotalCalls")) is int
            and type(row.get("SuccessfulCalls")) is int
            and row["SuccessfulCalls"] == row["TotalCalls"] > 0
            and fresh_timestamps["LastSuccessfulSeen"] != fresh_timestamps["LastSeen"]
        ):
            failures.append(
                f"{prefix} LastSuccessfulSeen must equal LastSeen when all calls succeeded"
            )
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

    def test_region_identity_is_case_insensitive_in_both_inputs(self):
        manifest = [dict(row, stampRegion=row["stampRegion"].upper()) for row in self.manifest]
        self.assertEqual(validate_expected(manifest), self.expected)
        rows = [dict(row, stampRegion=row["stampRegion"].upper()) for row in self.rows]
        self.assertEqual(evaluate_evidence(rows, self.expected, now=self.now), [])
        for manifest in (
            [self.manifest[0], dict(self.manifest[0], stampRegion="EASTUS")],
            self.manifest + [dict(self.manifest[0], stampRegion="EastUS")],
            [dict(row, stampRegion="UNKNOWN-REGION") for row in self.manifest],
        ):
            with self.subTest(manifest=manifest), self.assertRaises(ValueError):
                validate_expected(manifest)
        for rows in (
            [self.rows[0], dict(self.rows[0], stampRegion="EASTUS")],
            self.rows + [dict(self.rows[0], stampRegion="EastUS")],
        ):
            with self.subTest(rows=rows):
                failures = evaluate_evidence(rows, self.expected, now=self.now)
                self.assertTrue(any("duplicate model/region" in failure for failure in failures))
        failures = evaluate_evidence(
            [self.rows[0], dict(self.rows[0], stampRegion="EASTUS")],
            self.expected, now=self.now,
        )
        self.assertTrue(any("missing stamp evidence" in failure for failure in failures))
        rows = [self.rows[0], dict(self.rows[1], stampRegion="UNKNOWN-REGION")]
        self.assertTrue(any("must be reported explicitly" in failure for failure in
                            evaluate_evidence(rows, self.expected, now=self.now)))

    def test_region_normalization_preserves_exact_model_and_snapshot_identity(self):
        manifest = self.manifest + [
            dict(row, reqModel="MODEL-A", expectedSnapshot="SNAPSHOT-A")
            for row in self.manifest
        ]
        rows = self.rows + [
            dict(row, reqModel="MODEL-A", SnapshotsObserved=["SNAPSHOT-A"],
                 stampRegion=row["stampRegion"].upper())
            for row in self.rows
        ]
        self.assertEqual(evaluate_evidence(rows, validate_expected(manifest), now=self.now), [])
        for field, value in (("reqModel", "MODEL-A"), ("SnapshotsObserved", ["SNAPSHOT-A"])):
            rows = deepcopy(self.rows)
            rows[1][field] = value
            with self.subTest(field=field):
                self.assertTrue(evaluate_evidence(rows, self.expected, now=self.now))

    def test_cli_region_aliases_cannot_certify_a_missing_secondary(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "expected.json"
            evidence = Path(directory) / "evidence.json"
            fresh_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            rows = [dict(row, LastSeen=fresh_time, LastSuccessfulSeen=fresh_time)
                    for row in self.rows]
            alias_manifest = dict(self.manifest[0], stampRegion="EASTUS")
            alias_evidence = dict(rows[0], stampRegion="EASTUS")
            command = [sys.executable, str(Path(__file__).resolve()), str(evidence),
                       "--expected", str(manifest)]
            for expected_rows, evidence_rows, code, diagnostics in (
                ([self.manifest[0], alias_manifest], [rows[0], alias_evidence], 2,
                 ["duplicate model/region"]),
                (self.manifest + [alias_manifest], rows, 2, ["duplicate model/region"]),
                (self.manifest, [rows[0], alias_evidence], 1,
                 ["duplicate model/region", "missing stamp evidence"]),
                (self.manifest, rows + [alias_evidence], 1, ["duplicate model/region"]),
                ([dict(row, stampRegion=row["stampRegion"].upper()) for row in self.manifest],
                 rows, 0, []),
                (self.manifest,
                 [dict(row, stampRegion=row["stampRegion"].upper()) for row in rows], 0, []),
            ):
                manifest.write_text(json.dumps(expected_rows), encoding="utf-8")
                evidence.write_text(json.dumps(evidence_rows), encoding="utf-8")
                result = subprocess.run(command, capture_output=True, text=True, check=False)
                with self.subTest(code=code, expected=expected_rows, evidence=evidence_rows):
                    self.assertEqual(result.returncode, code, result.stderr)
                    self.assertNotIn("Traceback", result.stderr)
                    if code:
                        self.assertEqual(result.stdout, "")
                        for diagnostic in diagnostics:
                            self.assertIn(diagnostic, result.stderr)
                        self.assertNotIn("EASTUS", result.stderr)
                    else:
                        self.assertEqual(result.stderr, "")
                        self.assertIn("PASSED", result.stdout)

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
            rows = [dict(row, LastSeen=timestamp, LastSuccessfulSeen=timestamp) for row in self.rows]
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
        rows = [dict(row, LastSeen="2026-11-20T11:30:00Z",
                     LastSuccessfulSeen="2026-11-20T11:30:00Z") for row in self.rows]
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

    def test_successful_timestamp_cannot_exceed_total_timestamp(self):
        for last_seen, last_success, valid in (
            ("2026-11-20T11:59:00Z", "2026-11-20T11:59:00Z", True),
            ("2026-11-20T11:59:00Z", "2026-11-20T11:58:59.999999Z", True),
            ("2026-11-20T11:59:00Z", "2026-11-20T11:59:00.000001Z", False),
            ("2026-11-20T13:59:00+02:00", "2026-11-20T06:59:00-05:00", True),
            ("2026-11-20T13:59:00+02:00", "2026-11-20T06:59:00.000001-05:00", False),
            ("2026-11-20T06:59:00-05:00", "2026-11-20T13:58:00+02:00", True),
            ("2026-11-20T06:59:00-05:00", "2026-11-20T13:59:01+02:00", False),
        ):
            for index in (0, 1):
                rows = deepcopy(self.rows)
                rows[index].update(LastSeen=last_seen, LastSuccessfulSeen=last_success)
                with self.subTest(last_seen=last_seen, last_success=last_success, index=index):
                    failures = evaluate_evidence(rows, self.expected, now=self.now)
                    self.assertEqual(failures, [] if valid else [
                        f"evidence row-{index + 1}: LastSuccessfulSeen must not exceed LastSeen",
                    ])

    def test_cli_rejects_inconsistent_successful_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "expected.json"
            evidence = Path(directory) / "evidence.json"
            manifest.write_text(json.dumps(self.manifest), encoding="utf-8")
            now = datetime.now(timezone.utc)
            total_time = (now - timedelta(minutes=2)).isoformat()
            success_time = (now - timedelta(minutes=1)).isoformat()
            rows = [dict(row, LastSeen=total_time, LastSuccessfulSeen=total_time)
                    for row in self.rows]
            rows[1]["LastSuccessfulSeen"] = success_time
            evidence.write_text(json.dumps(rows), encoding="utf-8")
            command = [sys.executable, str(Path(__file__).resolve()), str(evidence),
                       "--expected", str(manifest)]
            for flags in ([], ["--max-age-minutes", "60"]):
                result = subprocess.run(command + flags, capture_output=True, text=True, check=False)
                with self.subTest(flags=flags):
                    self.assertEqual(result.returncode, 1)
                    self.assertEqual(result.stdout, "")
                    self.assertIn(
                        "evidence row-2: LastSuccessfulSeen must not exceed LastSeen", result.stderr,
                    )
                    self.assertNotIn("Traceback", result.stderr)
                    self.assertNotIn(total_time, result.stderr)
                    self.assertNotIn(success_time, result.stderr)
            rows[1]["LastSeen"] = success_time
            evidence.write_text(json.dumps(rows), encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stderr, "")
            self.assertIn("PASSED", result.stdout)

    def test_all_successful_calls_require_equal_timestamp_instants(self):
        for total_calls, successful_calls, last_success, valid in (
            (10, 10, "2026-11-20T11:58:59.999999Z", False),
            (1, 1, "2026-11-20T11:58:00Z", False),
            (10, 10, "2026-11-20T11:59:00Z", True),
            (1, 1, "2026-11-20T06:59:00-05:00", True),
            (10, 10, "2026-11-20T13:59:00+02:00", True),
            (10, 8, "2026-11-20T11:58:00Z", True),
            (10, 8, "2026-11-20T11:59:00Z", True),
        ):
            for index in (0, 1):
                rows = deepcopy(self.rows)
                rows[index].update(
                    TotalCalls=total_calls, SuccessfulCalls=successful_calls,
                    LastSeen="2026-11-20T11:59:00Z", LastSuccessfulSeen=last_success,
                )
                with self.subTest(total=total_calls, successes=successful_calls,
                                  last_success=last_success, index=index):
                    self.assertEqual(
                        evaluate_evidence(rows, self.expected, now=self.now),
                        [] if valid else [
                            f"evidence row-{index + 1}: LastSuccessfulSeen must equal LastSeen "
                            "when all calls succeeded",
                        ],
                    )

    def test_cli_rejects_all_success_timestamp_mismatch_and_recovers(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "expected.json"
            evidence = Path(directory) / "evidence.json"
            manifest.write_text(json.dumps(self.manifest), encoding="utf-8")
            now = datetime.now(timezone.utc)
            last_seen = now - timedelta(minutes=1)
            last_success = last_seen - timedelta(microseconds=1)
            rows = [
                dict(row, SuccessfulCalls=row["TotalCalls"],
                     LastSeen=last_seen.isoformat(), LastSuccessfulSeen=last_seen.isoformat())
                for row in self.rows
            ]
            rows[1]["LastSuccessfulSeen"] = last_success.isoformat()
            evidence.write_text(json.dumps(rows), encoding="utf-8")
            command = [sys.executable, str(Path(__file__).resolve()), str(evidence),
                       "--expected", str(manifest)]
            for flags in ([], ["--max-age-minutes", "60"]):
                result = subprocess.run(command + flags, capture_output=True, text=True, check=False)
                with self.subTest(flags=flags):
                    self.assertEqual(result.returncode, 1, result.stderr)
                    self.assertEqual(result.stdout, "")
                    self.assertEqual(
                        result.stderr.strip(),
                        "BCP snapshot gate FAILED:\nevidence row-2: LastSuccessfulSeen must equal "
                        "LastSeen when all calls succeeded",
                    )
            rows[1]["LastSuccessfulSeen"] = last_seen.astimezone(
                timezone(timedelta(hours=2))
            ).isoformat()
            evidence.write_text(json.dumps(rows), encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stderr, "")
            self.assertIn("PASSED", result.stdout)

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

    def test_manifest_rejects_unsupported_fields_without_echoing_them(self):
        for field in ("expected_snapshot", "req_model", "max_age_minutes",
                      "expectedContentFilter", "private-field"):
            for index in (0, 1):
                manifest = deepcopy(self.manifest)
                manifest[index][field] = "private-value"
                with self.subTest(field=field, index=index):
                    with self.assertRaises(ValueError) as caught:
                        validate_expected(manifest)
                    self.assertEqual(
                        str(caught.exception),
                        f"expected row-{index + 1}: unsupported fields; allowed fields: "
                        "reqModel, stampRegion, expectedSnapshot, metadata",
                    )

    def test_cli_manifest_field_validation_precedes_evidence_and_recovers(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "expected.json"
            evidence = Path(directory) / "evidence.json"
            fresh_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            rows = [dict(row, LastSeen=fresh_time, LastSuccessfulSeen=fresh_time,
                         Escaped429Count=0, BcpGateStatus="observed stamp")
                    for row in self.rows]
            command = [sys.executable, str(Path(__file__).resolve()), str(evidence),
                       "--expected", str(manifest)]
            for field in ("expected_snapshot", "max_age_minutes", "private-field"):
                manifest_rows = deepcopy(self.manifest)
                manifest_rows[1][field] = {"private-value": False}
                manifest.write_text(json.dumps(manifest_rows), encoding="utf-8")
                for evidence_present in (True, False):
                    if evidence_present:
                        evidence.write_text(json.dumps(rows), encoding="utf-8")
                    else:
                        evidence.unlink()
                    result = subprocess.run(command, capture_output=True, text=True, check=False)
                    with self.subTest(field=field, evidence_present=evidence_present):
                        self.assertEqual(result.returncode, 2, result.stderr)
                        self.assertEqual(result.stdout, "")
                        self.assertEqual(
                            result.stderr.strip(),
                            "BCP snapshot gate input error: expected row-2: unsupported fields; "
                            "allowed fields: reqModel, stampRegion, expectedSnapshot, metadata",
                        )
            manifest.write_text(json.dumps([
                dict(row, metadata={"private-field": {"max_age_minutes": 1}})
                for row in self.manifest
            ]), encoding="utf-8")
            evidence.write_text(json.dumps(rows), encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stderr, "")
            self.assertIn("PASSED", result.stdout)

    def test_cli_rejects_duplicate_json_members_in_both_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "expected.json"
            evidence = Path(directory) / "evidence.json"
            fresh_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            fresh_rows = [dict(row, LastSeen=fresh_time, LastSuccessfulSeen=fresh_time)
                          for row in self.rows]
            manifest_text = json.dumps([dict(row, metadata={"label": "probe"})
                                       for row in self.manifest])
            evidence_text = json.dumps([dict(row, metadata={"label": "probe"})
                                       for row in fresh_rows])
            command = [sys.executable, str(Path(__file__).resolve()), str(evidence),
                       "--expected", str(manifest)]
            cases = (
                (manifest, manifest_text, (
                    ('"expectedSnapshot"', "snapshot-b"),
                    ('"expectedSnapshot"', "snapshot-a"),
                    ('"stampReg\\u0069on"', "northeurope"),
                    ('"reqModel"', "model-b"),
                )),
                (evidence, evidence_text, (
                    ('"SuccessfulCalls"', 0),
                    ('"TotalCalls"', 0),
                    ('"LastSeen"', "2000-01-01T00:00:00Z"),
                    ('"LastSuccessfulSeen"', "2000-01-01T00:00:00Z"),
                    ('"SnapshotsObserved"', ["snapshot-b"]),
                    ('"stampReg\\u0069on"', "northeurope"),
                    ('"reqModel"', "model-b"),
                    ('"SuccessfulCalls"', 8),
                )),
            )
            for target, original, members in cases:
                contents = [
                    "[{" + name + ":" + json.dumps(value) + "," + original[2:]
                    for name, value in members
                ]
                contents.append(
                    '[{"probeMetadata":{"private-field":"private-value","private-field":0},'
                    + original[2:]
                )
                for content in contents:
                    manifest.write_text(manifest_text, encoding="utf-8")
                    evidence.write_text(evidence_text, encoding="utf-8")
                    target.write_text(content, encoding="utf-8")
                    result = subprocess.run(command, capture_output=True, text=True, check=False)
                    with self.subTest(target=target.name, content=content):
                        self.assertEqual(result.returncode, 2, result.stderr)
                        self.assertEqual(result.stdout, "")
                        self.assertIn("duplicate JSON object members", result.stderr)
                        self.assertNotIn("Traceback", result.stderr)
                        self.assertNotIn("private-field", result.stderr)
                        self.assertNotIn("private-value", result.stderr)
            manifest.write_text(manifest_text, encoding="utf-8")
            evidence.write_text(evidence_text, encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("PASSED", result.stdout)

    def test_cli_handles_json_parser_nesting_in_both_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "expected.json"
            evidence = Path(directory) / "evidence.json"
            fresh_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            fresh_rows = [dict(row, LastSeen=fresh_time, LastSuccessfulSeen=fresh_time)
                          for row in self.rows]
            command = [sys.executable, str(Path(__file__).resolve()), str(evidence),
                       "--expected", str(manifest)]
            for opening, closing in (("[", "]"), ('{"private-field":', "}")):
                for depth, code in ((16, 0), (sys.getrecursionlimit() * 2, 2)):
                    nested = opening * depth + '"private-value"' + closing * depth
                    for target, rows in ((manifest, self.manifest), (evidence, fresh_rows)):
                        manifest.write_text(json.dumps(self.manifest), encoding="utf-8")
                        evidence.write_text(json.dumps(fresh_rows), encoding="utf-8")
                        last_row = '{"metadata":' + nested + "," + json.dumps(rows[1])[1:]
                        target.write_text(
                            "[" + json.dumps(rows[0]) + "," + last_row + "]",
                            encoding="utf-8",
                        )
                        result = subprocess.run(command, capture_output=True, text=True, check=False)
                        with self.subTest(target=target.name, opening=opening, depth=depth):
                            self.assertEqual(result.returncode, code, result.stderr)
                            if code:
                                self.assertEqual(result.stdout, "")
                                self.assertEqual(
                                    result.stderr.strip(),
                                    "BCP snapshot gate input error: JSON exceeds the parser nesting limit.",
                                )
                            else:
                                self.assertEqual(result.stderr, "")
                                self.assertIn("PASSED", result.stdout)

    def test_cli_rejects_nonstandard_json_constants_in_both_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "expected.json"
            evidence = Path(directory) / "evidence.json"
            fresh_time = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            fresh_rows = [dict(row, LastSeen=fresh_time, LastSuccessfulSeen=fresh_time)
                          for row in self.rows]
            manifest_text = json.dumps(self.manifest)
            evidence_text = json.dumps(fresh_rows)
            command = [sys.executable, str(Path(__file__).resolve()), str(evidence),
                       "--expected", str(manifest)]
            for target, rows in ((manifest, self.manifest), (evidence, fresh_rows)):
                for constant in ("NaN", "Infinity", "-Infinity"):
                    for payload in (constant, '{"private-field":[' + constant + "]}"):
                        manifest.write_text(manifest_text, encoding="utf-8")
                        evidence.write_text(evidence_text, encoding="utf-8")
                        last_row = '{"metadata":' + payload + "," + json.dumps(rows[1])[1:]
                        target.write_text(
                            "[" + json.dumps(rows[0]) + "," + last_row + "]",
                            encoding="utf-8",
                        )
                        result = subprocess.run(command, capture_output=True, text=True, check=False)
                        with self.subTest(target=target.name, constant=constant, payload=payload):
                            self.assertEqual(result.returncode, 2, result.stderr)
                            self.assertEqual(result.stdout, "")
                            self.assertEqual(
                                result.stderr.strip(),
                                "BCP snapshot gate input error: non-standard JSON numeric "
                                "constants are not allowed.",
                            )
                for value in (None, True, 0, -1.5, "NaN", "Infinity", "-Infinity"):
                    manifest.write_text(manifest_text, encoding="utf-8")
                    evidence.write_text(evidence_text, encoding="utf-8")
                    target.write_text(json.dumps([
                        rows[0], dict(rows[1], metadata={"private-field": [value]}),
                    ]), encoding="utf-8")
                    result = subprocess.run(command, capture_output=True, text=True, check=False)
                    with self.subTest(target=target.name, valid_metadata=value):
                        self.assertEqual(result.returncode, 0, result.stderr)
                        self.assertEqual(result.stderr, "")
                        self.assertIn("PASSED", result.stdout)

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
            stale_time = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
            stale_rows = [dict(row, LastSeen=stale_time, LastSuccessfulSeen=stale_time)
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
        expected = validate_expected(load_json(args.expected))
        raw = load_json(args.evidence)
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
