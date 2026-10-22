#!/usr/bin/env node
// @ts-check
/**
 * A dependency-free Model Context Protocol server offering flowR's query API as a tool, over stdio
 * (newline-delimited JSON-RPC) or, with `--http [port]`, over stateless streamable HTTP (one JSON answer per POST).
 * The analyses run one at a time in a worker thread, which is replaced if it runs out of memory or (over http) time.
 */
const http = require('http');
const path = require('path');
const readline = require('readline');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { SupportedQueries } = require('@eagleoutice/flowr/queries/query');

/* over http, the code is untrusted */
const overHttp = isMainThread ? process.argv.includes('--http') : workerData.overHttp;

/** @param {string} text, cut so that, e.g., a whole call graph does not flood the client's context */
function answer(text, isError = false) {
	/* over http, do not reveal the server's paths in stack traces */
	const shown = overHttp ? text.replace(/\s*Report a Bug: \S+/g, '') : text;
	return { content: [{ type: 'text', text: shown.length > 5e4 ? `${shown.slice(0, 5e4)}\n[cut at 50000 characters, narrow the query]` : shown }], isError };
}

if(isMainThread) {
	main();
} else {
	analyzeInWorker();
}

function analyzeInWorker() {
	const { FlowrAnalyzerBuilder, TreeSitterExecutor } = require('@eagleoutice/flowr');
	const { QueriesSchema } = require('@eagleoutice/flowr/queries/query');
	const { asciiSummaryOfQueryResult } = require('@eagleoutice/flowr/queries/query-print');
	const { voidFormatter } = require('@eagleoutice/flowr/util/text/ansi');
	const { SecureMode } = require('@eagleoutice/flowr/util/secure-mode');
	if(overHttp) {
		/* forbid network access (e.g., the linter checking urls), processes, and R */
		SecureMode.enable();
	}
	void TreeSitterExecutor.initTreeSitter().then(() => {
		const parser = new TreeSitterExecutor();
		parentPort?.on('message', async({ queries, code, files = [] }) => {
			const invalid = QueriesSchema().required().validate(queries).error;
			if(invalid) {
				const schemas = (Array.isArray(queries) ? queries : []).map(q => SupportedQueries[/** @type {keyof typeof SupportedQueries} */ (q?.type)]?.schema.describe());
				return parentPort?.postMessage(answer(`Invalid queries: ${invalid.message}\n${JSON.stringify(schemas)}`, true));
			}
			/* over http, the code must not read the server's files, neither by source() nor by a config update re-enabling it */
			if(overHttp && queries.some((/** @type {any} */ q) => q?.type === 'config' || q?.query === 'config')) {
				return parentPort?.postMessage(answer('The config query is not available over http', true));
			}
			try {
				const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).configure('ignoreSourceCalls', overHttp).build();
				analyzer.addRequest(...(overHttp ? [] : files).map((/** @type {string} */ f) => `file://${path.resolve(f)}`), ...(code ? [{ request: /** @type {const} */ ('text'), content: code }] : []));
				const summary = await asciiSummaryOfQueryResult(voidFormatter, 0, await analyzer.query(queries), analyzer, queries);
					parentPort?.postMessage(answer(summary, /^Query: \S+ failed:/m.test(summary)));
			} catch(e) {
				parentPort?.postMessage(answer(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`, true));
			}
		});
	});
}

function main() {
	const { flowrVersion } = require('@eagleoutice/flowr/util/version');
	const { downloadFullSigDb, sigDbCacheComplete } = require('@eagleoutice/flowr/project/sigdb/sigdb-download');

	const Tool = {
		name:        'query',
		description: 'Statically analyze R code and search R package signatures with flowR queries (https://github.com/flowr-analysis/flowr/wiki/Query-API). Common ones: '
			+ '{"type":"static-slice","criteria":["12@x"]} for the code affecting x in line 12, {"type":"linter"} for lint findings, '
			+ '{"type":"dependencies"} for loaded libraries, read and written files, '
			+ '{"type":"guess-dep-versions"} for the package versions the code works with, '
			+ '{"type":"call-context","callName":"^read_"} for calls, '
			+ 'and, needing no code, {"type":"signature","package":"dplyr","function":"across"} to search signatures and versions (globs allowed), '
			+ '{"type":"function-info","name":"filter"} for the packages exporting a function. A query with wrong arguments is answered with its schema. Types: '
			+ Object.entries(SupportedQueries).map(([type, q]) => `${type} (${q.title})`).join(', '),
		inputSchema: { type: 'object', required: ['queries'], properties: {
			queries: { type: 'array', items: { type: 'object' } },
			code:    { type: 'string', description: 'R code to analyze.' },
			/* over http, anyone reaching the server could read its files */
			...(overHttp ? {} : { files: { type: 'array', items: { type: 'string' }, description: 'R files or project folders to analyze.' } })
		} },
		annotations: { readOnlyHint: true }
	};

	const spawn = () => {
		const w = new Worker(__filename, { workerData: { overHttp }, stdout: true, resourceLimits: overHttp ? { maxOldGenerationSizeMb: 2048 } : {} });
		w.stdout.pipe(process.stderr);
		return w;
	};
	/** @type {Worker} */
	let worker;
	/* the npm package only links the signature database (package versions and signatures), so fetch it into the cache once */
	/** @type {Promise<unknown>} */
	let queue = (sigDbCacheComplete() ? Promise.resolve() : downloadFullSigDb().catch(e => console.error(`No signature database: ${e}`)))
		.then(() => worker = spawn());
	let waiting = 0;

	/** @param {any} args @returns {Promise<unknown>} */
	function analyze(args) {
		if(overHttp && waiting >= 16) {
			return Promise.resolve(answer('The server is busy, try again later', true));
		}
		waiting++;
		return queue = queue.then(() => new Promise(resolve => {
			const done = (/** @type {unknown} */ result) => {
				clearTimeout(timer);
				worker.off('message', done).off('exit', died);
				waiting--;
				resolve(result);
			};
			const died = () => {
				done(answer('The analysis ran out of time or memory', true));
				worker = spawn();
			};
			const timer = overHttp ? setTimeout(() => void worker.terminate(), 30e3) : undefined;
			worker.on('message', done).on('exit', died);
			worker.postMessage(args);
		}));
	}

	/** @param {string} text */
	const parse = text => {
		try {
			return JSON.parse(text);
		} catch{
			return {};
		}
	};

	/** @param {any} msg the JSON-RPC message, answered with `undefined` if it is a notification */
	async function handle(msg) {
		const { id, method, params } = msg ?? {};
		const result = {
			'initialize': () => ({
				protocolVersion: params?.protocolVersion,
				capabilities:    { tools: {} },
				serverInfo:      { name: 'flowr', version: flowrVersion().toString() }
			}),
			'ping':       () => ({}),
			'tools/list': () => ({ tools: [Tool] }),
			'tools/call': () => params?.name === Tool.name ? analyze(params.arguments ?? {}) : answer(`Unknown tool ${params?.name}`, true)
		}[/** @type {string} */ (method)];
		if(id === undefined) {
			return undefined;
		}
		try {
			return { jsonrpc: '2.0', id, ...(result ? { result: await result() } : { error: { code: -32601, message: `Unknown method ${method}` } }) };
		} catch(e) {
			return { jsonrpc: '2.0', id, error: { code: -32602, message: String(e) } };
		}
	}

	if(!overHttp) {
		/* stdout belongs to the protocol */
		console.log = console.info = console.warn = console.error;
		readline.createInterface({ input: process.stdin }).on('line', async line => {
			const reply = line.trim() && await handle(parse(line));
			if(reply) {
				process.stdout.write(JSON.stringify(reply) + '\n');
			}
		}).on('close', () => void queue.then(() => setImmediate(() => process.exit(0))));
		return;
	}
	/* a secret path is the one access control every remote client supports */
	const route = process.env.FLOWR_MCP_PATH ?? '/mcp';
	http.createServer((req, res) => {
		/* browser pages must not reach the server, remote clients like ChatGPT send no origin */
		if(req.url !== route || req.method !== 'POST' || req.headers.origin) {
			return res.writeHead(req.url !== route ? 404 : req.method !== 'POST' ? 405 : 403).end();
		}
		let body = '';
		req.on('data', chunk => (body += chunk).length > 1e6 && req.destroy()).on('end', async() => {
			const reply = await handle(parse(body));
			res.writeHead(reply ? 200 : 202, { 'Content-Type': 'application/json' }).end(reply ? JSON.stringify(reply) : undefined);
		});
	}).listen(Number(process.argv[process.argv.indexOf('--http') + 1] || process.env.PORT || 1042), process.env.HOST ?? '127.0.0.1');
}
