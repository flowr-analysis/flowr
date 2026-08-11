/**
 * Finishes the flowR development setup after `npm ci`. It checks the prerequisites, fetches the large files,
 * wires the git hooks, and prints where to continue reading.
 *
 * Run it with `npm run setup:dev`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { FlowrGithubRef, FlowrWikiBaseRef } from '../src/documentation/doc-util/doc-files';
import { NewQuestionUrl } from '../src/documentation/doc-util/doc-issue';
import { minimumNodeMajor } from '../src/util/node-version';

/** the wiki pages to point a new developer to, named as the file in `wiki/` so that a rename is caught below */
const Pages: readonly [page: string, why: string][] = [
	['Onboarding', 'where to start as a developer'],
	['Setup', 'installing R, node, and flowR itself'],
	['Core', 'how an analysis is pipelined from parse to dataflow'],
	['Interface', 'the REPL, the server, and the API'],
	['Linting and Testing', 'which tests exist and how to run them'],
	['FAQ', 'editor configuration and common problems']
];

const ContributingRef = `${FlowrGithubRef}/tree/main/.github/CONTRIBUTING.md`;

const Commands: readonly [command: string, why: string][] = [
	['npm run flowr:dev', 'start the REPL on the current sources'],
	['npm test', 'run the functionality tests (watch mode)'],
	['npm run lint-local', 'typecheck and lint without the license check'],
	['npm run checkup', 'everything the CI runs, in parallel']
];

const problems: string[] = [];
const notes: string[] = [];

function run(command: string, args: readonly string[], { optional = false, capture = false } = {}): string | undefined {
	const result = spawnSync(command, args, { stdio: capture ? 'pipe' : 'inherit', shell: process.platform === 'win32', encoding: 'utf-8' });
	if(result.status === 0) {
		return capture ? result.stdout ?? '' : '';
	} else if(!optional) {
		problems.push(`\`${command} ${args.join(' ')}\` failed${result.error ? `: ${result.error.message}` : ''}`);
	}
	return undefined;
}

function step(title: string): void {
	console.log(`\n=== ${title}`);
}

/** the wiki turns spaces into dashes, so `Linting and Testing` lives at `.../Linting-and-Testing` */
function wikiUrl(page: string): string {
	return `${FlowrWikiBaseRef}/${page.replaceAll(' ', '-')}`;
}

step('checking prerequisites');
const nodeMajor = Number(process.versions.node.split('.')[0]);
if(nodeMajor < minimumNodeMajor()) {
	problems.push(`node ${process.versions.node} is too old, flowR needs ${minimumNodeMajor()}.x or newer (see ${wikiUrl('Setup')})`);
} else {
	console.log(`node ${process.versions.node} (ok)`);
}

const rVersion = run('R', ['--version'], { optional: true, capture: true });
if(rVersion) {
	console.log(rVersion.split('\n')[0].trim());
} else {
	notes.push(`R was not found. The tree-sitter engine works without it, but the r-shell engine and some tests need it (see ${wikiUrl('Engines')}).`);
}

if(run('git', ['lfs', 'version'], { optional: true, capture: true }) !== undefined) {
	step('fetching large files (git-lfs)');
	run('git', ['lfs', 'install', '--local'], { optional: true });
	if(run('git', ['lfs', 'pull'], { optional: true }) === undefined) {
		notes.push('git-lfs could not pull, so the setup continues without the large files. You can retry later with `git lfs pull`.');
	}
} else {
	notes.push('git-lfs is not installed. Everything but the wiki images works without it. You can install it from https://git-lfs.com/ and then run `git lfs pull`.');
}

step('configuring the git hooks');
if(existsSync('.githooks')) {
	run('git', ['config', '--local', 'core.hooksPath', '.githooks/']);
	console.log('hooks path set to .githooks/');
	/* the pre-push hook lints, so this doubles as a check that the hooks work. It needs a remote to run against. */
	if(run('git', ['remote', 'get-url', 'origin'], { optional: true, capture: true }) !== undefined) {
		step('testing the hooks with git push --dry-run, which lints but pushes nothing');
		if(run('git', ['push', '--dry-run'], { optional: true }) === undefined) {
			notes.push('`git push --dry-run` did not succeed. If the linter reported problems then fix them, and if the push itself failed then check your remote access.');
		}
	} else {
		notes.push('there is no `origin` remote, so the git hook test with `git push --dry-run` was skipped.');
	}
} else {
	problems.push('there is no .githooks directory, so this does not look like the flowR repository');
}

step('what to read next');
for(const [page, why] of Pages) {
	if(!existsSync(`wiki/${page}.md`)) {
		notes.push(`the wiki page \`${page}\` is not part of this checkout, so the link may be outdated`);
	}
	console.log(`  ${page.padEnd(20)} ${why}\n  ${''.padEnd(20)} ${wikiUrl(page)}`);
}
console.log(`  ${'Contributing'.padEnd(20)} commit conventions and git hooks\n  ${''.padEnd(20)} ${ContributingRef}`);

step('useful commands');
for(const [command, why] of Commands) {
	console.log(`  ${command.padEnd(20)} ${why}`);
}

if(notes.length > 0) {
	step('notes');
	for(const note of notes) {
		console.log(`  - ${note}`);
	}
}

if(problems.length > 0) {
	step('problems');
	for(const problem of problems) {
		console.log(`  - ${problem}`);
	}
	console.log(`\nsetup incomplete, please have a look at the problems above. If you are stuck, ask us at ${NewQuestionUrl}`);
	process.exit(1);
}

console.log(`\nIf anything is unclear, the wiki has a FAQ and you can always ask us at ${NewQuestionUrl}`);
console.log('\nsetup complete, happy hacking!');
