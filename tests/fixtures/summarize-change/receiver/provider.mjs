// Invoked as gh or glab from the isolated scenario workspace.
import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.git');
const [cli, ...args] = process.argv.slice(2);
appendFileSync(join(root, 'calls'), JSON.stringify([cli, ...args]) + '\n');
const { base, head, missing } = JSON.parse(readFileSync(join(root, 'fixture.json'), 'utf8'));
const title = 'Rename the <legacy> receiver';
const description = 'Replace retired input.';
const mr = 'https://gitlab.com/acme/tools/platform/receiver/-/merge_requests/32';
const project = 'projects/acme%2Ftools%2Fplatform%2Freceiver';
const endpoint = args.find(arg => /^(projects|repos)\//.test(arg));

function reply() {
  if (cli === 'gh') {
    if (args[0] === 'pr' && args[1] === 'view' &&
        args.includes(missing ? '17' : 'published-topic') && args.includes('github.com/acme/receiver')) {
      return { number: 17, title, body: description, url: 'https://github.com/acme/receiver/pull/17',
        baseRefOid: base, headRefOid: head, changedFiles: missing ? 2 : 1 };
    }
    if (args.includes('graphql')) {
      return [{ data: { repository: { pullRequest: { reviewThreads: {
        nodes: [], pageInfo: { hasNextPage: false }
      } } } } }];
    }
    if (missing && endpoint === 'repos/acme/receiver/pulls/17') {
      return 'diff --git a/after.txt b/after.txt\n--- a/after.txt\n+++ b/after.txt\n@@ -0,0 +1 @@\n+available hunk';
    }
    if (missing && endpoint === 'repos/acme/receiver/pulls/17/files?per_page=100') {
      return [[{ filename: 'after.txt', status: 'modified' }, { filename: 'other.txt', status: 'modified' }]];
    }
  }
  if (cli === 'glab' && args[0] === 'api' && args.includes('gitlab.com')) {
    if (endpoint === `${project}/merge_requests/32`) {
      return { iid: 32, project_id: 42, target_project_id: 42, source_project_id: 42,
        title, description, web_url: mr, diff_refs: { base_sha: base, head_sha: head, start_sha: base },
        changes_count: '1' };
    }
    if (endpoint === 'projects/42') {
      return { id: 42, web_url: 'https://gitlab.com/acme/tools/platform/receiver' };
    }
    if ([project, 'projects/42'].some(p => endpoint === `${p}/merge_requests/32/discussions?per_page=100`)) {
      return [{ id: 'thread', notes: [{ id: 912, resolvable: true, resolved: false,
        type: 'DiffNote', body: 'Why remove <retired>?', position: {
          position_type: 'text', old_path: 'before.txt', new_path: 'after.txt',
          old_line: 2, new_line: null, base_sha: base, head_sha: head, start_sha: base
        } }] }];
    }
  }
  throw Error(`Unexpected fixture request: ${cli} ${args.join(' ')}`);
}
try {
  const result = reply();
  console.log(typeof result === 'string' ? result : JSON.stringify(result));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
