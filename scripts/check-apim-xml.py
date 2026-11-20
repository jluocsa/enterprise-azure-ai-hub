#!/usr/bin/env python3
"""Check downloadable and rendered Studio APIM policies for well-formed XML."""

import argparse
from html.parser import HTMLParser
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent


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


def validate_studio(text: str):
    policies = StudioPolicies(text).policies
    if len(policies) != 1:
        raise ValueError(f"expected exactly one rendered APIM policy, found {len(policies)}")
    validate_policy(policies[0])


class ApimXmlTests(unittest.TestCase):
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
        (ROOT / "docs" / "public" / "kits" / "apim-foundry-spillover-policy.xml", validate_policy),
        (ROOT / "docs" / ".vitepress" / "dist" / "studio" / "index.html", validate_studio),
    )
    errors = []
    for path, validate in targets:
        try:
            validate(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, ET.ParseError, ValueError) as error:
            errors.append(f"{path.relative_to(ROOT)}: {error}")
    if errors:
        print("APIM XML gate FAILED:\n" + "\n".join(errors), file=sys.stderr)
        return 1
    print("APIM XML gate PASSED (downloadable kit + rendered Studio default; syntax only).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
