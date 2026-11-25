"""Collect change metadata and remote diffs through gh and glab."""

import json
import re
import subprocess
from tempfile import TemporaryFile
from urllib.parse import quote


def _encode(value):
    return quote(value, safe="!'()*")


def _path(value):
    return "/".join(_encode(part) for part in value.split("/"))


class ProviderError(RuntimeError):
    def __init__(self, message, stderr):
        self.stderr = stderr
        super().__init__(message)


def _run(*args):
    limit = 128 * 1024 * 1024
    with TemporaryFile() as out, TemporaryFile() as err:
        result = subprocess.run(args, stdout=out, stderr=err)
        if max(out.tell(), err.tell()) > limit:
            raise RuntimeError(f"{args[0]} output exceeded the 128 MiB limit")
        if result.returncode:
            err.seek(0)
            stderr = err.read().decode("utf-8", errors="replace")
            raise ProviderError(
                stderr.strip() or f"{args[0]} exited with {result.returncode}", stderr
            )
        out.seek(0)
        return out.read().decode("utf-8", errors="replace")


def _remote_diff(diff, files, count, provider):
    sections = sum(1 for _ in re.finditer(r"^diff --git ", diff, re.M))
    if re.fullmatch(r"[0-9]+", str(count)) and int(count) == len(files) == sections:
        warning = f"{provider} remote diff: file count matches, but server-side limits may omit patch content."
    else:
        expected = "unknown" if count is None else count
        warning = (
            f"{provider} remote diff may be incomplete: expected {expected} files, "
            f"listed {len(files)}, received {sections} diff sections."
        )
    return {"diff": diff, "files": files, "warning": warning}


_COMMENTS = (
    "nodes { body url author { __typename login } } pageInfo { hasNextPage endCursor }"
)
_THREAD_QUERY = (
    """query($owner:String!,$repo:String!,$number:Int!,$endCursor:String) {
  repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
    reviewThreads(first:50,after:$endCursor) { pageInfo { hasNextPage endCursor }
      nodes { id path line diffSide isOutdated isResolved comments(first:20) { %s } }
    }
  } }
}"""
    % _COMMENTS
)
_REPLIES_QUERY = (
    """query($id:ID!,$endCursor:String) {
  node(id:$id) { ... on PullRequestReviewThread { comments(first:100,after:$endCursor) { %s } } }
}"""
    % _COMMENTS
)


def _github(host, project, ref):
    def api(endpoint, *args):
        return _run("gh", "api", endpoint, "--hostname", host, *args)

    def view(identifier):
        return json.loads(
            _run(
                "gh",
                "pr",
                "view",
                "--repo",
                f"{host}/{project}",
                "--json",
                "number,title,url,body,baseRefOid,headRefOid,changedFiles",
                "--",
                identifier,
            )
        )

    parts = project.split("/")
    if len(parts) != 2 or not all(parts):
        raise ValueError("Expected GitHub project owner/repo.")
    owner, repo = parts
    try:
        pr = view(ref)
    except ProviderError as exc:
        if (
            re.fullmatch("[0-9]+", ref)
            or "no pull requests found for branch" not in exc.stderr
        ):
            raise
        local = json.loads(api(f"repos/{_path(project)}"))
        candidates = json.loads(
            _run(
                "gh",
                "pr",
                "list",
                "--repo",
                f"{host}/{project}",
                "--head",
                ref,
                "--limit",
                "2",
                "--json",
                "number",
            )
        )
        matches = [(project, item["number"]) for item in candidates]
        parent = (local.get("parent") or {}).get("full_name")
        if parent:
            branch = _encode(f"{owner}:{ref}")
            candidates = json.loads(
                api(f"repos/{_path(parent)}/pulls?state=open&head={branch}")
            )
            matches.extend((parent, item["number"]) for item in candidates)
        if len(matches) != 1:
            raise ValueError(
                f"Cannot uniquely resolve {project}:{ref}; specify the pull request URL."
            ) from None
        project, number = matches[0]
        owner, repo = project.split("/")
        pr = view(str(number))

    endpoint = f"repos/{_path(project)}/pulls/{pr['number']}"
    pages = json.loads(
        api(
            "graphql",
            "--paginate",
            "--slurp",
            "-f",
            f"query={_THREAD_QUERY}",
            "-f",
            f"owner={owner}",
            "-f",
            f"repo={repo}",
            "-F",
            f"number={pr['number']}",
        )
    )
    threads = []
    for page in pages:
        for thread in page["data"]["repository"]["pullRequest"]["reviewThreads"][
            "nodes"
        ]:
            comments = thread["comments"]
            notes = list(comments["nodes"])
            if thread["isResolved"] or thread["isOutdated"] or not notes:
                continue
            root = notes[0]
            author = root.get("author") or {}
            if author.get("__typename") == "Bot" or (
                author.get("login") or ""
            ).endswith("[bot]"):
                continue
            while comments["pageInfo"]["hasNextPage"]:
                reply = json.loads(
                    api(
                        "graphql",
                        "-f",
                        f"query={_REPLIES_QUERY}",
                        "-f",
                        f"id={thread['id']}",
                        "-f",
                        f"endCursor={comments['pageInfo']['endCursor']}",
                    )
                )
                comments = reply["data"]["node"]["comments"]
                notes.extend(comments["nodes"])
            threads.append(
                {
                    "path": thread["path"],
                    "line": thread["line"],
                    "side": thread["diffSide"],
                    "body": "\n\n".join(n["body"] for n in notes),
                    "url": root["url"],
                }
            )

    base, head = pr["baseRefOid"], pr["headRefOid"]

    def file_url(path, sha):
        return f"https://{host}/{_path(project)}/blob/{sha}/{_path(path)}"

    def fallback_diff():
        diff = api(endpoint, "-H", "Accept:application/vnd.github.diff")
        pages = json.loads(
            api(f"{endpoint}/files?per_page=100", "--paginate", "--slurp")
        )
        files = []
        for page in pages:
            for item in page:
                path = item["filename"]
                url = item.get("blob_url") or file_url(
                    path, base if item["status"] == "removed" else head
                )
                file = {"path": path, "url": url}
                if item.get("previous_filename"):
                    file["oldPath"] = item["previous_filename"]
                files.append(file)
        return _remote_diff(diff, files, pr.get("changedFiles"), "GitHub")

    return {
        "title": pr["title"],
        "url": pr["url"],
        "description": pr.get("body") or "",
        "base": base,
        "head": head,
        "threads": threads,
        "file_url": file_url,
        "fallback_diff": fallback_diff,
    }


def _gitlab(host, project, ref):
    def api(endpoint, *args):
        return _run("glab", "api", endpoint, "--hostname", host, *args)

    def get(endpoint, *args):
        return json.loads(api(endpoint, *args))

    target, iid = _encode(project), ref
    if not re.fullmatch("[0-9]+", ref):
        local = get(f"projects/{target}")
        candidates = get(
            f"merge_requests?scope=all&state=opened&source_branch={_encode(ref)}&per_page=100",
            "--paginate",
        )
        matches = [
            m
            for m in candidates
            if m["source_branch"] == ref
            and local["id"] in (m["source_project_id"], m["target_project_id"])
        ]
        if len(matches) != 1:
            raise ValueError(
                f"Found {len(matches)} open merge requests for {project}:{ref}; "
                "specify the merge request URL."
            )
        target, iid = matches[0]["target_project_id"], matches[0]["iid"]
    endpoint = f"projects/{target}/merge_requests/{iid}"
    mr = get(endpoint)
    refs = mr.get("diff_refs") or {}
    base, head = refs.get("base_sha"), refs.get("head_sha")
    if not base or not head:
        raise ValueError("GitLab has not prepared the merge request diff refs yet.")
    target_url = re.sub(r"/-/merge_requests/[0-9]+$", "", mr["web_url"])
    source_url = target_url
    if (
        mr.get("source_project_id")
        and mr["source_project_id"] != mr["target_project_id"]
    ):
        try:
            source_url = get(f"projects/{mr['source_project_id']}")["web_url"]
        except ProviderError as exc:
            if "(HTTP 404)" not in exc.stderr:
                raise

    threads = []
    for discussion in get(f"{endpoint}/discussions?per_page=100", "--paginate"):
        notes = discussion["notes"]
        root = notes[0] if notes else {}
        position = root.get("position")
        if (
            not position
            or not root.get("resolvable")
            or root.get("resolved")
            or root.get("system")
            or (root.get("author") or {}).get("bot")
        ):
            continue
        left = position.get("old_line") is not None and position.get("new_line") is None
        thread = {
            "path": position.get("old_path" if left else "new_path"),
            "line": position.get("old_line" if left else "new_line"),
            "side": "LEFT" if left else "RIGHT",
            "body": "\n\n".join(n["body"] for n in notes if not n.get("system")),
            "url": f"{mr['web_url']}#note_{root['id']}",
        }
        if position.get("head_sha") and position["head_sha"] != head:
            thread["earlierRevision"] = True
        threads.append(thread)

    def file_url(path, sha):
        return f"{source_url if sha == head else target_url}/-/blob/{sha}/{_path(path)}"

    def fallback_diff():
        diff = api(f"{endpoint}/raw_diffs")
        files = []
        for item in get(f"{endpoint}/diffs?per_page=100", "--paginate"):
            deleted = item.get("deleted_file")
            path = item["old_path" if deleted else "new_path"]
            file = {"path": path, "url": file_url(path, base if deleted else head)}
            if item.get("renamed_file"):
                file["oldPath"] = item["old_path"]
            files.append(file)
        return _remote_diff(diff, files, mr.get("changes_count"), "GitLab")

    return {
        "title": mr["title"],
        "url": mr["web_url"],
        "description": mr.get("description") or "",
        "base": base,
        "head": head,
        "threads": threads,
        "file_url": file_url,
        "fallback_diff": fallback_diff,
    }


def collect(provider, host, project, ref):
    if provider == "github":
        return _github(host, project, str(ref))
    if provider == "gitlab":
        return _gitlab(host, project, str(ref))
    raise ValueError(f"Unknown change provider: {provider}")
