import { afterAll, describe, expect, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import { withTreeSitter } from '../../../_helper/shell';
import { sigTmpDir, cleanupSigTmpDirs, hasBuiltInVertex as attachedExport } from '../../../_helper/sigdb';

afterAll(cleanupSigTmpDirs);
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { FlowrConfig } from '../../../../../src/config';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { readLocalSignatureSource, LocalSignatureSource } from '../../../../../src/project/plugins/package-version-plugins/sigdb-local';

/** materialise an installed-package directory (`DESCRIPTION` + `NAMESPACE`, plus optional `R/` sources) below `root` */
function writePackage(root: string, name: string, version: string, namespace: string, opts: { description?: string, rSources?: Record<string, string> } = {}): string {
	const dir = path.join(root, name);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, 'DESCRIPTION'), opts.description ?? `Package: ${name}\nVersion: ${version}\nTitle: Fixture\n`);
	fs.writeFileSync(path.join(dir, 'NAMESPACE'), namespace);
	if(opts.rSources) {
		fs.mkdirSync(path.join(dir, 'R'), { recursive: true });
		for(const [file, content] of Object.entries(opts.rSources)) {
			fs.writeFileSync(path.join(dir, 'R', file), content);
		}
	}
	return dir;
}

const mypkgNamespace = 'export(foo)\nexport(bar)\nS3method(print, myclass)\nexportPattern("^ignored")\n';

describe('sigdb on-disk package analysis (LocalSignatureSource)', withTreeSitter(() => {
	test('LocalSignatureSource answers the export view (S3 flattened, exportPattern not expanded); not base R', async() => {
		const root = sigTmpDir('sigdb-local-');
		writePackage(root, 'mypkg', '1.2.3', mypkgNamespace);
		const src = await readLocalSignatureSource(FlowrConfig.default(), path.join(root, 'mypkg'));
		expect(src).toBeInstanceOf(LocalSignatureSource);
		expect(src.has('mypkg')).toBe(true);
		expect(src.has('nope')).toBe(false);
		expect(src.packageNames()).toEqual(['mypkg']);
		const exp = src.lookup('mypkg');
		expect(exp?.version).toBe('1.2.3');
		expect([...(exp?.exported ?? [])].sort()).toEqual(['bar', 'foo', 'print.myclass']);
		expect(exp?.cran).toBe(false);
		expect(src.isBaseR('mypkg')).toBe(false);       // an on-disk package is never treated as base R
		expect(src.functions('mypkg')).toEqual([]);     // analysed, but this fixture has no R/ sources
		expect(src.functions('nope')).toBeUndefined();  // an unknown package has no function view at all
		expect(src.coreVersions('mypkg')).toBeUndefined();
		expect(src.latestVersion('mypkg')?.str).toBe('1.2.3');
		expect(src.lookup('nope')).toBeUndefined();
	});

	test('running flowR over the R/ sources extracts full signatures (params, forced, defaults, callees)', async() => {
		const root = sigTmpDir('sigdb-local-');
		writePackage(root, 'mypkg', '1.2.3', 'export(greet)\n', { rSources: { 'funcs.R':
			'greet <- function(name, greeting = "hi", ...) {\n  msg <- paste(greeting, name)\n  cat(msg)\n  toupper(msg)\n}\n'
			+ 'internal_helper <- function(x) x * 2\n' } });
		const src = await readLocalSignatureSource(FlowrConfig.default(), path.join(root, 'mypkg'));

		const fns = src.functions('mypkg') ?? [];
		const byName = (n: string) => {
			const f = fns.find(x => x.name === n); expect(f, `function ${n}`).toBeDefined(); return f as NonNullable<typeof f>;
		};
		expect(fns.map(f => f.name).sort()).toEqual(['greet', 'internal_helper']);

		const greet = byName('greet');
		expect(greet.exported).toBe(true);
		expect(greet.line).toBe(1);
		// parameters: names in order, defaults captured, `...` present, `name`/`greeting` are read (forced)
		expect(greet.signature.map(p => p.name)).toEqual(['name', 'greeting', '...']);
		const greeting = greet.signature[1];
		expect(greeting.optional).toBe(true);            // has a default value
		expect(greeting.default).toBe('"hi"');
		expect(greet.signature[0].optional).toBe(false); // `name` has no default (crawlr's `missing`)
		expect(greet.signature.find(p => p.name === 'name')?.forced).toBe(true);
		// callees: the named calls in the body, deduped and sorted; operators like `*` are not calls
		expect(greet.callees).toEqual(['cat', 'paste', 'toupper']);

		const helper = byName('internal_helper');
		expect(helper.exported).toBe(false);             // not in NAMESPACE
		expect(helper.callees).toEqual([]);
		// the export view still reports the NAMESPACE exports; internal names land in `internal`
		expect(src.lookup('mypkg')?.exported).toEqual(['greet']);
		expect(src.lookup('mypkg')?.internal).toEqual(['internal_helper']);
	});

	test('declared DESCRIPTION dependencies are parsed (name, type, constraint), skipping the R clause', async() => {
		const root = sigTmpDir('sigdb-local-');
		writePackage(root, 'mypkg', '1.2.3', 'export(foo)\n', {
			description: 'Package: mypkg\nVersion: 1.2.3\nDepends: R (>= 4.0)\nImports: utils (>= 2.0), methods\n'
		});
		const src = await readLocalSignatureSource(FlowrConfig.default(), path.join(root, 'mypkg'));
		const deps = src.dependencies('mypkg') ?? [];
		expect(deps.map(d => d.name).sort()).toEqual(['methods', 'utils']);   // the `R` version clause is skipped
		const utils = deps.find(d => d.name === 'utils');
		expect(utils?.constraint).toContain('2.0');
	});

	test('a whole library folder adds every package it contains', async() => {
		const root = sigTmpDir('sigdb-local-');
		writePackage(root, 'aa', '0.1.0', 'export(a1)\n');
		writePackage(root, 'bb', '2.0.0', 'export(b1)\nexport(b2)\n');
		const src = await readLocalSignatureSource(FlowrConfig.default(), root);   // the folder, not one package
		expect(src.packageNames().sort()).toEqual(['aa', 'bb']);
		expect(src.lookup('bb')?.exported.toSorted()).toEqual(['b1', 'b2']);
	});
}));

describe('sigdb on-disk package resolution end-to-end', withTreeSitter(ts => {
	test('addLocalPackages (a single package folder) makes library(mypkg) resolve its exports', async() => {
		const root = sigTmpDir('sigdb-local-');
		writePackage(root, 'mypkg', '1.2.3', mypkgNamespace);
		const plugin = new FlowrAnalyzerPackageVersionsSigDbPlugin();
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(SigDbPluginName).registerPlugins(plugin).build();
		analyzer.addRequest('library(mypkg)\nfoo()\nbar()');

		// only the package's folder is needed to generate a resolvable sigdb entry
		const added = await plugin.addLocalPackages(path.join(root, 'mypkg'), analyzer.inspectContext().config);
		expect(added).toEqual(['mypkg']);

		const df = await analyzer.dataflow();
		expect(attachedExport(df, 'mypkg', 'foo')).toBe(true);   // library(mypkg) attaches the analysed exports
		expect(attachedExport(df, 'mypkg', 'bar')).toBe(true);
		expect(attachedExport(df, 'mypkg', 'nope')).toBe(false);
	});

	test('explicit sources take precedence over later sources for the same package', async() => {
		const root = sigTmpDir('sigdb-local-');
		writePackage(root, 'dup', '9.9.9', 'export(fresh)\n');
		const staleRoot = sigTmpDir('sigdb-local-stale-');
		writePackage(staleRoot, 'dup', '0.0.1', 'export(old)\n');
		const onDisk = await readLocalSignatureSource(FlowrConfig.default(), path.join(root, 'dup'));
		const stale = await readLocalSignatureSource(FlowrConfig.default(), path.join(staleRoot, 'dup'));

		const plugin = new FlowrAnalyzerPackageVersionsSigDbPlugin(onDisk, stale);   // onDisk registered first
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
			.unregisterPlugins(SigDbPluginName).registerPlugins(plugin).build();
		analyzer.addRequest('library(dup)\nfresh()\nold()');
		const df = await analyzer.dataflow();
		expect(attachedExport(df, 'dup', 'fresh')).toBe(true);   // the first source wins
		expect(attachedExport(df, 'dup', 'old')).toBe(false);    // the shadowed stale source is not used
	});
}));
