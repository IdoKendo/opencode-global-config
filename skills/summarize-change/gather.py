"""Collect review evidence without changing the checkout."""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote
from urllib.parse import urlsplit

from providers import collect


def git(*args):
    return subprocess.run(
        ["git", *args], stdin=subprocess.DEVNULL, capture_output=True, check=True
    ).stdout.decode("utf-8", errors="replace")


def config(key):
    try:
        return git("config", "--get", key).strip()
    except subprocess.CalledProcessError as error:
        if error.returncode == 1:
            return ""
        raise


def resolve_target(ref, override):
    if ref and re.match(r"https?://", ref, re.I):
        url = urlsplit(ref)
        match = re.fullmatch(r"/(.+?)/(-/merge_requests|pull)/(\d+)(?:/.*)?", url.path)
        if not match or not url.hostname or url.username is not None:
            raise ValueError("Expected a pull request or merge request URL.")
        project, kind, number = match.groups()
        provider = "github" if kind == "pull" else "gitlab"
        if override and provider != override:
            raise ValueError("URL and --provider disagree.")
        return provider, url.netloc, unquote(project), number

    current = git("branch", "--show-current").strip()
    if not current and not ref:
        raise ValueError("Detached HEAD: specify a change URL, number, or branch.")
    number = ref and ref.isdecimal()
    branch = ref if ref and not number else current
    remote = branch and config(f"branch.{branch}.remote")
    upstream = remote and config(f"branch.{branch}.merge").removeprefix("refs/heads/")
    if not remote or remote == ".":
        remotes = git("remote").splitlines()
        if "origin" in remotes:
            remote = "origin"
        elif len(remotes) == 1:
            remote = remotes[0]
        else:
            raise ValueError("Cannot select a remote. Specify the change URL.")
    raw = git("remote", "get-url", remote).strip()
    scp = "://" not in raw and re.fullmatch(r"(?:[^@/]+@)?([^:/]+):(.+)", raw)
    url = urlsplit(f"ssh://{scp[1]}/{scp[2]}" if scp else raw)
    host = url.hostname
    if not host:
        raise ValueError("Remote has no host. Specify the change URL.")
    if url.scheme != "ssh" and url.port:
        host = f"{host}:{url.port}"
    provider = override or {"github.com": "github", "gitlab.com": "gitlab"}.get(host)
    if not provider:
        raise ValueError(
            f"Unknown provider for {host}; specify --provider github or gitlab."
        )
    return (
        provider,
        host,
        url.path.strip("/").removesuffix(".git"),
        ref if number else upstream or branch,
    )


def local_diff(change, file_url):
    head = change["head"]
    if not all(
        re.fullmatch(r"(?:[0-9a-f]{40}|[0-9a-f]{64})", sha)
        for sha in (change["base"], head)
    ):
        return None
    try:
        base = git("merge-base", change["base"], head).strip()
    except subprocess.CalledProcessError:
        return None
    args = ["diff", "--no-ext-diff", "--no-textconv", "--find-renames"]
    revisions = [base, head, "--"]
    fields = iter(git(*args, "--name-status", "-z", *revisions).split("\0"))
    files = []
    for status in fields:
        if not status:
            break
        old = next(fields)
        path = next(fields) if status.startswith("R") else old
        entry = {
            "path": path,
            "status": status,
            "url": file_url(path, base if status == "D" else head),
        }
        if old != path:
            entry["oldPath"] = old
        files.append(entry)
    return {
        "base": base,
        "files": files,
        "diff": git(*args, "--stat", "--patch", "--no-color", *revisions),
        "warning": None,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path)
    parser.add_argument("ref", nargs="?", help="Change URL, number, or branch")
    parser.add_argument("--provider", choices=["github", "gitlab"])
    args = parser.parse_args()
    provider, host, project, ref = resolve_target(args.ref, args.provider)
    change = collect(provider, host, project, ref)
    fallback = change.pop("fallback_diff")
    evidence = local_diff(change, change.pop("file_url")) or fallback()
    args.out.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (args.out / "evidence.json").open("w", encoding="utf-8") as output:
        json.dump({"provider": provider, **change, **evidence}, output, indent=2)


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(
            (
                error.stderr.decode(errors="replace")
                if isinstance(error.stderr, bytes)
                else error.stderr
            )
            or str(error)
        )
    except (ValueError, OSError, RuntimeError) as error:
        sys.exit(str(error))
