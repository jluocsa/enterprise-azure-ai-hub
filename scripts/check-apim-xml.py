#!/usr/bin/env python3
"""Check published APIM XML, per-attempt spillover bodies, and SSE response safety."""

import argparse
from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
from html.parser import HTMLParser
import io
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "docs" / "public" / "kits" / "apim-foundry-spillover-policy.xml"
RETRY_CONDITION = (
    "@(context.Response != null && "
    "(context.Response.StatusCode == 429 || context.Response.StatusCode == 503))"
)


class StudioPolicies(HTMLParser):
    def __init__(self, text: str):
        super().__init__(convert_charrefs=True)
        self.policies: list[str] = []
        self.fragments: list[str] | None = None
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag == "pre" and "apim-code" in dict(attrs).get("class", "").split():
            self.fragments = []

    def handle_data(self, data):
        if self.fragments is not None:
            self.fragments.append(data)

    def handle_endtag(self, tag):
        if tag == "pre" and self.fragments is not None:
            self.policies.append("".join(self.fragments))
            self.fragments = None


def validate_policy(text: str):
    root = ET.fromstring(text)
    if root.tag != "policies":
        raise ValueError("expected a <policies> document")
    return root


def validate_studio(text: str):
    policies = StudioPolicies(text).policies
    if len(policies) != 1:
        raise ValueError(f"expected exactly one rendered APIM policy, found {len(policies)}")
    return validate_policy(policies[0])


def validate_spillover(root):
    """Static contract checks, not a C# interpreter or an APIM runtime probe."""
    def require(condition, message):
        if not condition:
            raise ValueError(f"spillover body contract: {message}")

    inbound = root.find("inbound")
    require(inbound is not None, "missing inbound policies")
    snapshots = inbound.findall("set-variable[@name='original-request-body']")
    require(len(snapshots) == 1, "capture exactly one original request body")
    require(
        snapshots[0].get("value")
        == "@(context.Request.Body.As<string>(preserveContent: true))",
        "snapshot must preserve the original string without JSON reserialization",
    )
    primary = inbound.findall(".//set-backend-service")
    require(
        len(primary) == 1 and primary[0].get("backend-id") == "foundry-ptu-primary",
        "PTU-only rewriting requires an explicit PTU primary, not a mixed-SKU pool",
    )
    require(primary[0] in list(inbound), "primary routing must be unconditional")
    snapshot_index = list(inbound).index(snapshots[0])
    for index, policy in enumerate(inbound):
        if policy.tag == "set-body" or policy.findall(".//set-body"):
            require(snapshot_index < index, "snapshot must precede every inbound body rewrite")

    retries = root.findall("./backend/retry")
    require(len(retries) == 1, "expected one backend retry")
    retry = retries[0]
    require(
        retry.get("condition") == RETRY_CONDITION and retry.get("count") == "1",
        "retry only once on a non-null pre-stream 429/503 response",
    )
    require(
        [child.tag for child in retry] == ["choose", "forward-request"],
        "select the retry leg and restore its body before forwarding",
    )
    branches = list(retry[0])
    require(
        len(branches) == 1 and branches[0].tag == "when"
        and branches[0].get("condition") == RETRY_CONDITION,
        "restoration must be conditional on the failed primary response",
    )
    branch = branches[0]
    require(
        [child.tag for child in branch] == ["set-backend-service", "set-body"],
        "retry must select Standard and restore the body without further mutation",
    )
    require(
        branch[0].get("backend-id") == "foundry-standard-spillover",
        "retry must target Standard explicitly, not a mixed-SKU pool",
    )
    require(
        (branch[1].text or "").strip()
        == '@((string)context.Variables["original-request-body"])',
        "Standard retry must restore the captured original string",
    )
    require(
        retry[1].get("buffer-request-body") == "true",
        "request replay buffering is required independently of response streaming",
    )
    require(
        len(root.findall("./backend/*")) == 1,
        "no body or routing policies may override the retry outside its block",
    )


def validate_sse(root):
    """Guard visible streaming policies; inherited policies and C# need live review."""
    forwards = root.findall("./backend//forward-request")
    if not forwards or any(policy.get("buffer-response") != "false" for policy in forwards):
        raise ValueError("SSE response contract: every forward-request must set buffer-response=\"false\"")
    outbound = root.find("outbound")
    if outbound is None:
        raise ValueError("SSE response contract: missing outbound policies")
    body_policies = {
        "set-body", "validate-content", "json-to-xml", "xml-to-json",
        "find-and-replace", "xsl-transform", "cache-store",
    }
    for policy in outbound.iter():
        if policy.tag in body_policies:
            raise ValueError(f"SSE response contract: outbound {policy.tag} can buffer or replace events")
        expressions = [policy.text or "", *policy.attrib.values()]
        if any(re.search(r"\bcontext\s*\.\s*Response\s*\.\s*Body\b", text) for text in expressions):
            raise ValueError("SSE response contract: outbound expression accesses context.Response.Body")


class ApimXmlTests(unittest.TestCase):
    def test_published_spillover_contract(self):
        root = validate_policy(KIT.read_text(encoding="utf-8"))
        validate_spillover(root)
        validate_sse(root)
        from html import escape
        rendered = f'<pre class="apim-code"><code>{escape(ET.tostring(root, encoding="unicode"))}</code></pre>'
        validate_spillover(validate_studio(rendered))
        validate_sse(validate_studio(rendered))

    def test_rejects_response_buffering_regressions(self):
        source = validate_policy(KIT.read_text(encoding="utf-8"))
        for value in (None, "true", "@(false)", ""):
            with self.subTest(value=value):
                root = deepcopy(source)
                forward = root.find("./backend/retry/forward-request")
                if value is None:
                    forward.attrib.pop("buffer-response")
                else:
                    forward.set("buffer-response", value)
                with self.assertRaisesRegex(ValueError, "SSE response contract"):
                    validate_sse(root)
        for mutation in ("missing-forward", "buffered-second-forward", "missing-outbound"):
            with self.subTest(mutation=mutation):
                root = deepcopy(source)
                if mutation == "missing-forward":
                    retry = root.find("./backend/retry")
                    retry.remove(retry.find("forward-request"))
                elif mutation == "buffered-second-forward":
                    ET.SubElement(root.find("backend"), "forward-request")
                else:
                    root.remove(root.find("outbound"))
                with self.assertRaisesRegex(ValueError, "SSE response contract"):
                    validate_sse(root)

    def test_rejects_nested_outbound_body_policies_and_expressions(self):
        source = validate_policy(KIT.read_text(encoding="utf-8"))
        for tag in ("set-body", "validate-content", "json-to-xml", "xml-to-json",
                    "find-and-replace", "xsl-transform", "cache-store"):
            with self.subTest(tag=tag):
                root = deepcopy(source)
                branch = ET.SubElement(ET.SubElement(root.find("outbound"), "choose"), "otherwise")
                ET.SubElement(branch, tag)
                with self.assertRaisesRegex(ValueError, "SSE response contract"):
                    validate_sse(root)
        for expression in ("@(context.Response.Body.As<string>(preserveContent: true))",
                           "@{ var response = context . Response\n . Body; return response; }"):
            for attribute in (False, True):
                with self.subTest(expression=expression, attribute=attribute):
                    root = deepcopy(source)
                    policy = ET.SubElement(root.find("outbound"), "set-variable", name="body")
                    if attribute:
                        policy.set("value", expression)
                    else:
                        policy.text = expression
                    with self.assertRaisesRegex(ValueError, "SSE response contract"):
                        validate_sse(root)
        root = deepcopy(source)
        ET.SubElement(root.find("outbound"), "set-variable", name="status",
                      value="@(context.Response.StatusCode)")
        validate_sse(root)  # Header/status access and inbound request rewriting remain allowed.

    def test_cli_blocks_sse_regressions_in_kit_and_rendered_studio(self):
        from html import escape
        source = KIT.read_text(encoding="utf-8")
        buffered = source.replace('buffer-response="false"', 'buffer-response="true"')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            kit = root / "policy.xml"
            studio = root / "docs" / ".vitepress" / "dist" / "studio" / "index.html"
            studio.parent.mkdir(parents=True)
            for target in (None, "kit", "studio"):
                kit.write_text(buffered if target == "kit" else source, encoding="utf-8")
                rendered = buffered if target == "studio" else source
                studio.write_text(f'<pre class="apim-code"><code>{escape(rendered)}</code></pre>',
                                  encoding="utf-8")
                stdout, stderr = io.StringIO(), io.StringIO()
                with self.subTest(target=target), patch.dict(globals(), ROOT=root, KIT=kit), \
                        patch.object(sys, "argv", ["check-apim-xml.py"]), \
                        redirect_stdout(stdout), redirect_stderr(stderr):
                    self.assertEqual(main(), 0 if target is None else 1)
                self.assertEqual("PASSED" in stdout.getvalue(), target is None)
                if target is not None:
                    self.assertIn("SSE response contract", stderr.getvalue())
                    self.assertIn(str((kit if target == "kit" else studio).relative_to(root)),
                                  stderr.getvalue())

    def test_rejects_body_loss_regressions(self):
        source = validate_policy(KIT.read_text(encoding="utf-8"))
        for mutation in (
            "missing-snapshot", "late-snapshot", "reserialized-snapshot",
            "pooled-primary", "pooled-retry", "missing-restore",
            "wrong-restore", "unguarded-restore", "unbuffered-replay",
            "late-rewrite", "forward-before-restore", "unsafe-retry-condition",
        ):
            with self.subTest(mutation=mutation):
                root = deepcopy(source)
                inbound = root.find("inbound")
                snapshot = inbound.find("set-variable[@name='original-request-body']")
                retry = root.find("./backend/retry")
                branch = retry.find("./choose/when")
                if mutation == "missing-snapshot":
                    inbound.remove(snapshot)
                elif mutation == "late-snapshot":
                    inbound.remove(snapshot)
                    inbound.append(snapshot)
                elif mutation == "reserialized-snapshot":
                    snapshot.set("value", "@(context.Request.Body.As<JObject>().ToString())")
                elif mutation == "pooled-primary":
                    inbound.find("set-backend-service").set("backend-id", "mixed-sku-pool")
                elif mutation == "pooled-retry":
                    branch[0].set("backend-id", "mixed-sku-pool")
                elif mutation == "missing-restore":
                    branch.remove(branch[1])
                elif mutation == "wrong-restore":
                    branch[1].text = "@(context.Request.Body.As<string>())"
                elif mutation == "unguarded-restore":
                    branch.set("condition", "@(true)")
                elif mutation == "unbuffered-replay":
                    retry[1].attrib.pop("buffer-request-body")
                elif mutation == "late-rewrite":
                    ET.SubElement(branch, "set-body").text = "@(strippedBody)"
                elif mutation == "forward-before-restore":
                    forward = retry[1]
                    retry.remove(forward)
                    retry.insert(0, forward)
                elif mutation == "unsafe-retry-condition":
                    retry.set("condition", "@(context.Response.StatusCode == 429)")
                with self.assertRaisesRegex(ValueError, "spillover body contract"):
                    validate_spillover(root)

    def test_expression_encoding_round_trips(self):
        text = """<policies>
          <set-variable value="@(context.Variables[&quot;key&quot;])" />
          <set-body>@{ return body.As&lt;JObject&gt;(); }</set-body>
        </policies>"""
        validate_policy(text)
        policy = ET.fromstring(text)
        self.assertEqual(policy[0].get("value"), '@(context.Variables["key"])')
        self.assertEqual(policy[1].text, "@{ return body.As<JObject>(); }")
        # Rendered HTML adds a separate encoding layer around the copyable XML.
        from html import escape
        validate_studio(f'<pre class="apim-code"><code>{escape(text)}</code></pre>')

    def test_rejects_broken_expressions(self):
        for text in (
            '<policies><set-variable value="@(vars["key"])" /></policies>',
            '<policies><set-body>@{ return body.As<JObject>(); }</set-body></policies>',
            '<policies><set-body>@(a && b)</set-body></policies>',
            '<policies><inbound></policies>',
        ):
            with self.subTest(text=text), self.assertRaises(ET.ParseError):
                validate_policy(text)

    def test_rejects_missing_or_duplicate_studio_output(self):
        policy = '<pre class="apim-code"><code>&lt;policies /&gt;</code></pre>'
        for text in ("", '<pre class="other">&lt;policies /&gt;</pre>', policy * 2):
            with self.subTest(text=text), self.assertRaises(ValueError):
                validate_studio(text)

    def test_rejects_wrong_root_and_invalid_rendered_policy(self):
        with self.assertRaises(ValueError):
            validate_policy("<html />")
        with self.assertRaises(ET.ParseError):
            validate_studio('<pre class="apim-code">&lt;policies&gt;</pre>')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(ApimXmlTests)
        return 0 if unittest.TextTestRunner().run(suite).wasSuccessful() else 1

    targets = (
        (KIT, validate_policy),
        (ROOT / "docs" / ".vitepress" / "dist" / "studio" / "index.html", validate_studio),
    )
    errors = []
    for path, validate in targets:
        try:
            policy = validate(path.read_text(encoding="utf-8"))
            validate_spillover(policy)
            validate_sse(policy)
        except (OSError, UnicodeError, ET.ParseError, ValueError) as error:
            errors.append(f"{path.relative_to(ROOT)}: {error}")
    if errors:
        print("APIM XML gate FAILED:\n" + "\n".join(errors), file=sys.stderr)
        return 1
    print("APIM XML gate PASSED (kit + Studio default; XML, static spillover body and SSE response contracts, not live APIM execution).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
