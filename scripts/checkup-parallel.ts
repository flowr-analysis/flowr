// Runs checkup jobs (lint, tests, wiki, docker) concurrently to log files; exits non-zero if any fails.
//   npm run checkup [-- --no-docker | lint tests system mutations wiki labels pages docker]

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { stripAnsi } from '../src/util/text/ansi';

interface Job {
	id:       string
	label:    string
	argv:     string[]
	summary?: boolean
	needs?:   string[]
	/** the share of the vitest workers a vitest job gets, by how much work it has */
	weight?:  number
}
interface JobResult {
	job:      Job
	ok:       boolean
	code:     number
	ms:       number
	logPath:  string
	skipped?: boolean
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
	{ id: 'lint',      label: 'lint',                 argv: [npm, 'run', 'lint'] },
	{ id: 'tests',     label: 'functionality tests',  argv: [npm, 'run', 'test:all', '--', '--run', '--allowOnly=false'], summary: true, weight: 2 },
	{ id: 'system',    label: 'system tests',         argv: [npm, 'run', 'test:system', '--', '--run'], weight: 1 },
	{ id: 'yields',    label: 'yield snippets',       argv: [npm, 'run', 'test:yields', '--', '--run'] },
	{ id: 'mutations', label: 'mutation tests',       argv: [npm, 'run', 'test:mutations', '--', '--run'], summary: true, weight: 4 },
	{ id: 'wiki',      label: 'wiki generation',      argv: [npm, 'run', 'wiki'] },
	{ id: 'labels',    label: 'generic labels',       argv: [npm, 'run', 'check:generic-labels'] },
	{ id: 'load',      label: 'standalone loading',   argv: [npm, 'run', 'check:standalone-load'] },
	{ id: 'pages',     label: 'landing pages',        argv: [npm, 'run', 'gen:landing'], needs: ['tests', 'mutations'] },
	{ id: 'docker',    label: 'docker build + smoke', argv: [npm, 'run', 'test:docker'] }
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
for(const element of jobs) {
	for(const need of element.needs ?? []) {
		const dependency = allJobs.find(j => j.id === need);
		if(dependency !== undefined && !jobs.includes(dependency)) {
			jobs = [...jobs, dependency];
		}
	}
}
if(jobs.length === 0) {
	console.error(`no matching jobs; known ids: ${allJobs.map(j => j.id).join(', ')}`);
	process.exit(2);
}

/*
 * Split what the machine has to offer now across the concurrent vitest jobs via --maxWorkers so they do not
 * oversubscribe it: bounded by the idle cores and by the available memory, after keeping some of both for the other
 * jobs (lint, wiki, docker) and the desktop. `FLOWR_CHECKUP_WORKERS` overrides the workers per vitest job.
 */
const vitestIds = new Set(['tests', 'system', 'mutations']);
const GiB = 1024 ** 3;
/** what one vitest worker may hold at its peak, the R shell it spawns included */
const perWorkerMemory = 2 * GiB;
const otherJobs = jobs.filter(j => !vitestIds.has(j.id)).length;
const reservedCores = 2 + otherJobs;
const reservedMemory = 4 * GiB + otherJobs * GiB;
const cores = Math.max(1, os.availableParallelism?.() ?? os.cpus().length);
/* what the machine has to offer now: the cores the current load leaves idle and the memory still available */
const idleCores = cores - Math.ceil(os.loadavg()[0]);
const availableMemory = os.freemem();
const vitestJobs = jobs.filter(j => vitestIds.has(j.id));
const totalWeight = vitestJobs.reduce((sum, j) => sum + (j.weight ?? 1), 0);
const totalWorkers = Math.min(idleCores - reservedCores, Math.floor((availableMemory - reservedMemory) / perWorkerMemory));
const override = Number(process.env.FLOWR_CHECKUP_WORKERS);
/* split by weight, as an even split leaves the longest job (the mutations) running on few workers long after the others are done */
const workersOf = (j: Job) => Number.isInteger(override) && override > 0 ? override : Math.max(1, Math.round(totalWorkers * (j.weight ?? 1) / totalWeight));
console.log(`checkup budget: ${idleCores} of ${cores} cores idle, ${(availableMemory / GiB).toFixed(1)} GiB available, workers per vitest job: ${vitestJobs.map(j => `${j.id} ${workersOf(j)}`).join(', ')}`);
jobs = jobs.map(j => vitestIds.has(j.id) ? { ...j, argv: [...j.argv, `--maxWorkers=${workersOf(j)}`, ...(j.summary ? ['--', '--make-summary'] : [])] } : j);

/** run the jobs below the priority of the desktop, so a full checkup keeps the machine usable */
function lowerPriority(pid: number | undefined): void {
	if(pid === undefined) {
		return;
	}
	try {
		os.setPriority(pid, 10);
	} catch{
		// not permitted here, run at the normal priority
	}
}

const logPrefix = 'flowr-checkup-';

/** log dirs stay around to be inspected after a run, so prune the older ones to not pile up in tmp */
function pruneOldLogDirs(keep: number): void {
	let dirs: { path: string, mtime: number }[];
	try {
		dirs = fs.readdirSync(os.tmpdir())
			.filter(n => n.startsWith(logPrefix))
			.map(n => path.join(os.tmpdir(), n))
			.flatMap(p => {
				try {
					const stat = fs.statSync(p);
					return stat.isDirectory() ? [{ path: p, mtime: stat.mtimeMs }] : [];
				} catch{
					return [];
				}
			});
	} catch{
		return;
	}
	for(const { path: p } of dirs.sort((a, b) => b.mtime - a.mtime).slice(keep)) {
		try {
			fs.rmSync(p, { recursive: true, force: true });
		} catch{
			// a concurrent checkup may own it, leave it be
		}
	}
}

// keep the previous run, so that with this run's dir at most two remain
pruneOldLogDirs(1);
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), logPrefix));
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

console.log(bold(`\ncheckup (parallel): ${jobs.map(j => j.id).join(', ')}`));
console.log(dim(`logs: ${logDir}\n`));

const started = Date.now();

// live state per job, so the heartbeat can report what is still running and each job's latest output line
const live = new Map<string, JobState>(jobs.map(j => [j.id, { label: j.label, begin: started, done: false, last: j.needs ? `waits for ${j.needs.join(', ')}` : '' }]));

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
		const line = stripAnsi(chunk.toString()).split('\n').map(l => l.trim()).filter(Boolean).pop();
		if(line) {
			state.last = line.length > 80 ? line.slice(0, 79) + '…' : line;
		}
	};
	return new Promise<JobResult>(resolve => {
		const child = spawn(job.argv[0], job.argv.slice(1), { shell: false });
		lowerPriority(child.pid);
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

function skip(job: Job, failed: readonly string[]): Promise<JobResult> {
	const logPath = path.join(logDir, `${job.id}.log`);
	fs.writeFileSync(logPath, `skipped, as ${failed.join(', ')} did not pass, so the full test results are missing\n`);
	(live.get(job.id) as JobState).done = true;
	console.log(`${dim('SKIP')} ${bold(job.label)} ${dim(`(needs ${failed.join(', ')})`)}`);
	return Promise.resolve({ job, ok: false, code: 1, ms: 0, logPath, skipped: true });
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
	const scheduled = new Map<string, Promise<JobResult>>();
	const schedule = (job: Job): Promise<JobResult> => {
		const known = scheduled.get(job.id);
		if(known !== undefined) {
			return known;
		}
		const result = Promise.all(jobs.filter(j => job.needs?.includes(j.id)).map(schedule)).then(done => {
			const failed = done.filter(d => !d.ok).map(d => d.job.id);
			return failed.length === 0 ? run(job) : skip(job, failed);
		});
		scheduled.set(job.id, result);
		return result;
	};
	const results = await Promise.all(jobs.map(schedule));
	clearInterval(heartbeat);

	// structured summary, failures last so the tail of a failing log is the last thing on screen
	const pad = Math.max(...results.map(r => r.job.label.length));
	console.log(bold('\nsummary'));
	for(const r of results) {
		console.log(`  ${r.ok ? green('PASS') : r.skipped ? dim('SKIP') : red('FAIL')}  ${r.job.label.padEnd(pad)}  ${dim(`${(r.ms / 1000).toFixed(1)}s`)}`);
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
