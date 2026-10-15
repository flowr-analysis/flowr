import { afterAll, assert, beforeAll, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrConfig } from '../../../src/config';
import { ProjectKind } from '../../../src/project/context/project-kind';
import { label } from '../_helper/label';

/** A `flowr.json` that flowR finds on its own belongs to the analyzed project, its security-sensitive options must not apply. */
describe('Project config trust', () => {
	const evil = '/tmp/evil.sh';
	let root: string;
	let project: string;
	let nested: string;
	let oldHome: string | undefined;

	const writeProjectConfig = (config: unknown) => fs.writeFileSync(path.join(project, 'flowr.json'), JSON.stringify(config));
	const effective = (config: FlowrConfig): FlowrConfig[] => [config, ...Object.values(ProjectKind).map(k => FlowrConfig.forKind(config, k))];
	const sensitiveValuesOf = (config: FlowrConfig): unknown[] => effective(config).flatMap(c => [
		...c.engines.flatMap(e => Object.entries(e).filter(([k]) => k !== 'type').map(([, v]) => v)),
		c.solver.sigdb.additionalPaths ?? [], c.solver.sigdb.downloadRepo, c.solver.sigdb.installedLibrary?.paths ?? []
	]).flat().filter((v, i, all) => v !== undefined && v !== false && all.indexOf(v) === i);

	beforeAll(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-config-trust-'));
		project = path.join(root, 'project');
		nested = path.join(project, 'R');
		fs.mkdirSync(nested, { recursive: true });
		// isolate from the global config of whoever runs the tests
		oldHome = process.env.FLOWR_CONFIG_HOME;
		process.env.FLOWR_CONFIG_HOME = path.join(root, 'global');
	});
	afterAll(() => {
		if(oldHome === undefined) {
			delete process.env.FLOWR_CONFIG_HOME;
		} else {
			process.env.FLOWR_CONFIG_HOME = oldHome;
		}
		fs.rmSync(root, { recursive: true, force: true });
	});

	const hostile: [string, unknown][] = [
		['the reported r-shell rPath', { engines: [{ type: 'r-shell', rPath: evil }], defaultEngine: 'r-shell' }],
		['a relative rPath', { engines: [{ type: 'r-shell', rPath: './.github/r-wrapper.sh' }] }],
		['an rPath after another engine', { engines: [{ type: 'tree-sitter' }, { type: 'r-shell', rPath: evil }] }],
		['a tree-sitter grammar wasm', { engines: [{ type: 'tree-sitter', wasmPath: evil }] }],
		['a tree-sitter runtime wasm', { engines: [{ type: 'tree-sitter', treeSitterWasmPath: evil }] }],
		['a signature database', { solver: { sigdb: { additionalPaths: [evil] } } }],
		['a download repository', { solver: { sigdb: { downloadRepo: 'evil/repo' } } }],
		['an installed library', { solver: { sigdb: { installedLibrary: { enabled: true, paths: [evil] } } } }],
		...Object.values(ProjectKind).map(k => [`an rPath in the ${k} specialization`, { specializeConfig: { [k]: { engines: [{ type: 'r-shell', rPath: evil }] } } }] as [string, unknown]),
		['an rPath in an inherited specialization', { specializeConfig: { [ProjectKind.Package]: { inherit: ProjectKind.ShinyApp }, [ProjectKind.ShinyApp]: { engines: [{ type: 'r-shell', rPath: evil }] } } }]
	];

	describe.each(hostile)('%s', (_, config) => {
		test(label('is dropped from a project config in the working directory', ['name-normal'], ['other']), () => {
			writeProjectConfig(config);
			assert.deepStrictEqual(sensitiveValuesOf(FlowrConfig.fromFile('flowr.json', project)), []);
		});
		test(label('is dropped from a project config in a parent directory', ['name-normal'], ['other']), () => {
			writeProjectConfig(config);
			assert.deepStrictEqual(sensitiveValuesOf(FlowrConfig.fromFile('flowr.json', nested)), []);
		});
		test(label('is dropped when parsing an untrusted config', ['name-normal'], ['other']), () => {
			const parsed = FlowrConfig.parse(JSON.stringify(config), false);
			assert.isDefined(parsed);
			assert.deepStrictEqual(sensitiveValuesOf(parsed), []);
		});
		test(label('applies when the user trusts the project', ['name-normal'], ['other']), () => {
			writeProjectConfig(config);
			assert.isNotEmpty(sensitiveValuesOf(FlowrConfig.fromFile('flowr.json', nested, true)));
		});
		test(label('applies from a config file the user names', ['name-normal'], ['other']), () => {
			writeProjectConfig(config);
			assert.isNotEmpty(sensitiveValuesOf(FlowrConfig.fromFile(path.join(project, 'flowr.json'))));
		});
	});

	test(label('all other options of a project config still apply', ['name-normal'], ['other']), () => {
		writeProjectConfig({ ignoreSourceCalls: true, engines: [{ type: 'r-shell', rPath: evil }], defaultEngine: 'r-shell' });
		const config = FlowrConfig.fromFile('flowr.json', nested);
		assert.isTrue(config.ignoreSourceCalls);
		assert.strictEqual(config.defaultEngine, 'r-shell', 'the engine may still be chosen, only not the binary');
		assert.deepStrictEqual(sensitiveValuesOf(config), []);
	});

	test(label('the global config is trusted', ['name-normal'], ['other']), () => {
		fs.rmSync(path.join(project, 'flowr.json'), { force: true });
		const global = path.join(process.env.FLOWR_CONFIG_HOME as string, 'flowr.json');
		fs.mkdirSync(path.dirname(global), { recursive: true });
		fs.writeFileSync(global, JSON.stringify({ engines: [{ type: 'r-shell', rPath: '/opt/R/4.4/bin/R' }] }));
		try {
			assert.deepStrictEqual(sensitiveValuesOf(FlowrConfig.fromFile('flowr.json', nested)), ['/opt/R/4.4/bin/R']);
		} finally {
			fs.rmSync(global);
		}
	});

	/* so that a new option naming an executable or a file to load cannot slip in untagged */
	test(label('every string option is classified as security-sensitive or not', ['name-normal'], ['other']), () => {
		const notSensitive = new Set([
			'defaultEngine', 'defaultPlugins.*', 'engines.*.type', 'logLevel', 'linter.disabledRules.*',
			'project.basePackages.*', 'project.classification.notebookExtensions.*', 'project.classification.shinyDescriptionTypes.*',
			'project.classification.shinyEntryFiles.*', 'project.classification.shinyUsagePattern', 'project.discovery.ignore.*',
			'project.discovery.perKind.*.exclude.*', 'project.discovery.perKind.*.include.*', 'project.implicitSources.*', 'project.useProjectType',
			'repl.plugins.*', 'solver.assumeAttachedPackages.*', 'solver.resolveSource.dropPaths', 'solver.resolveSource.inferWorkingDirectory',
			// reads files the invoking user can already read (see SECURITY.md)
			'solver.resolveSource.searchPath.*',
			'solver.sigdb.assumedRVersion', 'solver.sigdb.installedLibrary.packages.*', 'solver.sigdb.versionOverrides.*',
			'solver.sigdb.versionSelection', 'solver.variables', 'solver.versionManagement.linkedVersionGroups.*.*', 'specializeConfig.*.inherit'
		]);
		const sensitive = new Set(FlowrConfig.securitySensitivePaths().map(p => p.join('.')));
		const unclassified: string[] = [];
		const walk = (d: { type?: string, keys?: Record<string, unknown>, items?: unknown[], matches?: { schema?: unknown }[], patterns?: { rule?: unknown }[] } | undefined, at: string[]): void => {
			if(!d || sensitive.has(at.join('.'))) {
				return;
			}
			if(d.type === 'string' && !notSensitive.has(at.join('.')) && !at.includes('inputSources')) {
				unclassified.push(at.join('.'));
			}
			for(const [k, v] of Object.entries(d.keys ?? {})) {
				walk(v as typeof d, [...at, k]);
			}
			for(const i of d.items ?? []) {
				walk(i as typeof d, [...at, '*']);
			}
			for(const m of d.matches ?? []) {
				walk(m.schema as typeof d, at);
			}
			for(const p of d.patterns ?? []) {
				walk(p.rule as typeof d, [...at, '*']);
			}
		};
		walk(FlowrConfig.Schema.describe(), []);
		assert.deepStrictEqual(unclassified, [], 'classify these options in the config schema (securitySensitive) or in this test');
	});
});
