#!/usr/bin/env python3
"""Check local hyperlinks and HTML fragments in the rendered VitePress site."""

import argparse
import os
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import unquote, urljoin, urlsplit


class Page(HTMLParser):
    def __init__(self, text: str):
        super().__init__(convert_charrefs=True)
        self.anchors: set[str] = set()
        self.links: list[tuple[int, str]] = []
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.anchors.add(attrs["id"])
        if tag == "a":
            if attrs.get("name"):
                self.anchors.add(attrs["name"])
            if "href" in attrs:
                self.links.append((self.getpos()[0], attrs["href"] or ""))


def check_links(root: Path, base: str) -> tuple[list[str], int, int]:
    if not base.startswith("/") or not base.endswith("/") or urlsplit(base).path != base:
        raise ValueError("site base must be an absolute path ending in '/', without query or fragment")
    root = root.resolve()
    pages = {
        file.resolve(): Page(file.read_text(encoding="utf-8"))
        for file in sorted(root.rglob("*.html"))
    }
    if not pages:
        raise ValueError(f"no generated HTML pages found in {root}; run npm run docs:build first")

    errors = []
    checked = 0
    for source, page in pages.items():
        relative = source.relative_to(root).as_posix()
        # cleanUrls serves chapter.html as /chapter and index.html as its directory.
        route = relative.removesuffix("index.html") if source.name == "index.html" else relative.removesuffix(".html")
        source_url = f"https://local.invalid{base}{route}"
        for line, href in sorted(set(page.links)):
            try:
                parsed = urlsplit(href)
                if parsed.scheme or parsed.netloc:
                    continue
                checked += 1
                resolved = urlsplit(urljoin(source_url, href))
                pathname = unquote(resolved.path, errors="strict")
                if not pathname.startswith(base):
                    raise ValueError(f"local path is outside site base {base}")
                target = (root / pathname[len(base):]).resolve()
                if not target.is_relative_to(root):
                    raise ValueError("local path escapes the generated site")

                if pathname.endswith("/"):
                    candidates = [target / "index.html"]
                else:
                    candidates = [target, Path(f"{target}.html"), target / "index.html"]
                target = next((file for file in candidates if file.is_file()), None)
                if target is None:
                    raise ValueError("target file does not exist")
                target = target.resolve()
                if not target.is_relative_to(root):
                    raise ValueError("target file escapes the generated site")
                fragment = unquote(resolved.fragment, errors="strict")
                if fragment and target.suffix == ".html" and fragment not in pages[target].anchors:
                    raise ValueError(f"HTML anchor #{fragment} does not exist")
            except ValueError as error:
                errors.append(f"{relative}:{line}: {href!r}: {error}")
    return errors, len(pages), checked


class LinkGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, path: str, text: str):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding="utf-8")

    def test_rendered_routes_downloads_and_encoded_anchors(self):
        self.write("index.html", """
            <a href="/hub/chapters/one?view=full#named%20anchor">Chapter</a>
            <a href="/hub/studio/#agent-eval">Studio</a>
            <a href="/hub/kits/gate.py" download>Kit</a>
            <a href="/hub/chapters/one.html#heading&amp;details">HTML</a>
            <a href="/hub/chapters/model.v1#present">Dotted clean URL</a>
        """)
        self.write("chapters/one.html", """
            <h2 id="heading&amp;details">Heading</h2><a name="named anchor"></a>
            <a href="#heading%26details">Same page</a>
            <a href="../studio/#agent-eval">Relative</a>
            <a href="../?query=1">Home</a>
            <pre>&lt;a href="/hub/missing"&gt;Example&lt;/a&gt;</pre>
            <script>const example = '<a href="/hub/missing">';</script>
        """)
        self.write("studio/index.html", '<button id="agent-eval">Tool</button><a href="../">Home</a>')
        self.write("chapters/model.v1.html", '<h2 id="present">Heading</h2>')
        self.write("kits/gate.py", "print('example')")
        errors, pages, checked = check_links(self.root, "/hub/")
        self.assertEqual(errors, [])
        self.assertEqual((pages, checked), (4, 9))

    def test_missing_files_fragments_and_base_escapes_fail(self):
        self.write("index.html", """
            <a href="/hub/missing">Missing page</a>
            <a href="/hub/kits/missing.py">Missing download</a>
            <a href="/hub/chapter#absent">Missing anchor</a>
            <a href="/hub/chapter/#present">Incorrect directory route</a>
            <a href="/chapter">Missing base</a>
            <a href="/hub/%2e%2e/outside">Encoded escape</a>
        """)
        self.write("chapter.html", '<h2 id="present">Heading</h2>')
        errors, _, checked = check_links(self.root, "/hub/")
        self.assertEqual((len(errors), checked), (6, 6))
        self.assertTrue(any("HTML anchor #absent" in error for error in errors))
        self.assertTrue(any("outside site base" in error for error in errors))
        self.assertTrue(any("escapes the generated site" in error for error in errors))
        self.assertTrue(all(error.startswith("index.html:") for error in errors))

    def test_root_base_and_external_links(self):
        self.write("index.html", """
            <a href="/chapter#present">Local</a>
            <a href="https://example.invalid/missing">External</a>
            <a href="//example.invalid/missing">Protocol relative</a>
            <a href="mailto:review@example.invalid">Mail</a>
            <a href="data:text/plain,example">Data</a>
        """)
        self.write("chapter.html", '<h2 id="present">Heading</h2>')
        self.assertEqual(check_links(self.root, "/"), ([], 2, 1))

    def test_empty_build_and_invalid_base_fail(self):
        with self.assertRaisesRegex(ValueError, "no generated HTML"):
            check_links(self.root, "/hub/")
        for base in ("hub/", "//example.invalid/", "/hub/?query=1", "/hub"):
            with self.subTest(base=base), self.assertRaises(ValueError):
                check_links(self.root, base)

    def test_cli_returns_failure_with_actionable_diagnostic(self):
        self.write("index.html", '<a href="/hub/missing#absent">Broken</a>')
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), str(self.root), "--base", "/hub/"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("index.html:1:", result.stderr)
        self.assertIn("target file does not exist", result.stderr)
        self.assertNotIn("PASSED", result.stdout)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", nargs="?", type=Path, default=Path(__file__).resolve().parents[1] / "docs/.vitepress/dist")
    parser.add_argument("--base", default=os.environ.get("VITEPRESS_BASE") or "/enterprise-azure-ai-hub/")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(LinkGateTests))
        return 0 if result.wasSuccessful() else 1
    try:
        errors, pages, checked = check_links(args.site, args.base)
    except (OSError, ValueError) as error:
        print(f"Link integrity gate FAILED: {error}", file=sys.stderr)
        return 1
    if errors:
        print(f"Link integrity gate FAILED ({len(errors)} violation(s)):", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(f"Link integrity gate PASSED ({pages} HTML pages, {checked} local hyperlinks; external URLs not fetched).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
