// Run the checkup jobs (lint, functionality + system tests, wiki, docker) concurrently, each to a log file,
// with live progress and a structured summary. Exits non-zero if any fails.
//   npm run checkup [-- --no-docker | lint tests ...]

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface Job {
	id:    string
	label: string
	argv:  string[]
}
interface JobResult {
	job:     Job
	ok:      boolean
	code:    number
	ms:      number
	logPath: string
}
interface JobState {
	label: string
	begin: number
	done:  boolean
	last:  string
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** every job: a stable id, a label, and the argv to run (all forced into no-watch / one-shot mode) */
const allJobs: Job[] = [
	{ id: 'lint',   label: 'lint',                 argv: [npm, 'run', 'lint'] },
	{ id: 'tests',  label: 'functionality tests',  argv: [npm, 'run', 'test', '--', '--run', '--allowOnly=false'] },
	{ id: 'system', label: 'system tests',         argv: [npm, 'run', 'test:system', '--', '--run'] },
	{ id: 'wiki',   label: 'wiki generation',      argv: [npm, 'run', 'wiki'] },
	{ id: 'docker', label: 'docker build + smoke', argv: [npm, 'run', 'test:docker'] }
];

const args = process.argv.slice(2);
const noDocker = args.includes('--no-docker');
const picked = args.filter(a => !a.startsWith('--'));
let jobs = allJobs;
if(picked.length > 0) {
	jobs = allJobs.filter(j => picked.includes(j.id));
} else if(noDocker) {
	jobs = allJobs.filter(j => j.id !== 'docker');
}
if(jobs.length === 0) {
	console.error(`no matching jobs; known ids: ${allJobs.map(j => j.id).join(', ')}`);
	process.exit(2);
}

// the jobs run concurrently and the vitest ones (tests, system) would each spawn a worker per core, so the
// combined pools would heavily oversubscribe the machine. Split the cores across the concurrently-running
// vitest jobs (keeping ~1 core of headroom for lint/wiki/docker + this orchestrator) via `--maxWorkers`.
const vitestIds = new Set(['tests', 'system']);
const cores = Math.max(1, os.availableParallelism?.() ?? os.cpus().length);
const runningVitest = Math.max(1, jobs.filter(j => vitestIds.has(j.id)).length);
const perVitest = Math.max(1, Math.floor((cores - 1) / runningVitest));
jobs = jobs.map(j => vitestIds.has(j.id) ? { ...j, argv: [...j.argv, `--maxWorkers=${perVitest}`] } : j);

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-checkup-'));
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

console.log(bold(`\ncheckup (parallel): ${jobs.map(j => j.id).join(', ')}`));
console.log(dim(`logs: ${logDir}\n`));

const started = Date.now();

// live state per job, so the heartbeat can report what is still running and each job's latest output line
const live = new Map<string, JobState>(jobs.map(j => [j.id, { label: j.label, begin: started, done: false, last: '' }]));

/** run one job, streaming its combined output to a per-job log file; resolve with its result record */
function run(job: Job): Promise<JobResult> {
	const logPath = path.join(logDir, `${job.id}.log`);
	const log = fs.createWriteStream(logPath);
	const state = live.get(job.id) as JobState;
	const begin = Date.now();
	state.begin = begin;
	console.log(`${dim('->')} ${bold(job.label)} started`);
	const note = (chunk: Buffer | string) => {
		log.write(chunk);
		// keep the last non-empty line for the heartbeat (strip ansi so the ticker stays tidy)
		// eslint-disable-next-line no-control-regex
		const line = chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').split('\n').map(l => l.trim()).filter(Boolean).pop();
		if(line) {
			state.last = line.length > 80 ? line.slice(0, 79) + '…' : line;
		}
	};
	return new Promise<JobResult>(resolve => {
		const child = spawn(job.argv[0], job.argv.slice(1), { shell: false });
		child.stdout.on('data', note);
		child.stderr.on('data', note);
		const finish = (code: number) => {
			log.end();
			state.done = true;
			const ms = Date.now() - begin;
			const ok = code === 0;
			console.log(`${ok ? green('PASS') : red('FAIL')} ${bold(job.label)} ${dim(`(${(ms / 1000).toFixed(1)}s)`)}`);
			resolve({ job, ok, code, ms, logPath });
		};
		child.on('error', err => {
			note(`\nfailed to spawn: ${err.message}\n`);
			finish(1);
		});
		child.on('close', code => finish(code ?? 1));
	});
}

// intermediate progress: every 15s report the still-running jobs, their elapsed time, and their latest line
const HeartbeatMs = 15_000;
const heartbeat = setInterval(() => {
	const running = [...live.values()].filter(s => !s.done);
	if(running.length === 0) {
		return;
	}
	const elapsed = ((Date.now() - started) / 1000).toFixed(0);
	console.log(dim(`\n  [${elapsed}s] ${running.length} running:`));
	for(const s of running) {
		const secs = ((Date.now() - s.begin) / 1000).toFixed(0);
		console.log(dim(`    ${s.label} (${secs}s)${s.last ? `  ${s.last}` : ''}`));
	}
}, HeartbeatMs);
heartbeat.unref?.();

void (async() => {
	const results = await Promise.all(jobs.map(run));
	clearInterval(heartbeat);

	// structured summary, failures last so the tail of a failing log is the last thing on screen
	const pad = Math.max(...results.map(r => r.job.label.length));
	console.log(bold('\nsummary'));
	for(const r of results) {
		console.log(`  ${r.ok ? green('PASS') : red('FAIL')}  ${r.job.label.padEnd(pad)}  ${dim(`${(r.ms / 1000).toFixed(1)}s`)}`);
	}

	const failed = results.filter(r => !r.ok);
	for(const r of failed) {
		console.log(red(`\n----- ${r.job.label} (exit ${r.code}) -- last 40 lines of ${r.logPath} -----`));
		console.log(fs.readFileSync(r.logPath, 'utf8').split('\n').slice(-40).join('\n'));
	}

	const total = ((Date.now() - started) / 1000).toFixed(1);
	console.log(bold(`\n${failed.length === 0 ? green('all jobs passed') : red(`${failed.length}/${results.length} job(s) failed`)} in ${total}s (wall clock)`));
	process.exit(failed.length === 0 ? 0 : 1);
})();
