import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { addPackages, expFn, fakeSigDb, namespacePackage, sigdbAnalyzer, ver } from '../../../_helper/sigdb';
import { label } from '../../../_helper/label';
import { SigDatabase, type PackageSignatureSource } from '../../../../../src/project/sigdb/reader';
import { SigDbBuilder } from '../../../../../src/project/sigdb/build';
import { DepType } from '../../../../../src/project/sigdb/schema';
import { EnvType, REnvironment, type Environment } from '../../../../../src/dataflow/environments/environment';
import { FlowrConfig } from '../../../../../src/config';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';
import type { FlowrAnalyzer } from '../../../../../src/project/flowr-analyzer';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { metaPackageCore } from '../../../../../src/project/attached-packages';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { DfgVertex } from '../../../../../src/dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../../../../src/dataflow/graph/edge';
import type { DataflowInformation } from '../../../../../src/dataflow/info';
import { Resolve } from '../../../../../src/dataflow/environments/resolve-helper';
import { AmbientStateName, KeyedState } from '../../../../../src/dataflow/environments/ambient-state-name';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

type Dep = { name: string, type: DepType };
const depends = (name: string): Dep => ({ name, type: DepType.Depends });
const imports = (name: string): Dep => ({ name, type: DepType.Imports });

/**
 * One package per case: `Depends` chains, cycles and diamonds, `Imports`-only packages, the dependency kinds R
 * neither attaches nor loads, the `R` pseudo-dependency, meta-packages, a package masking what it depends on, and
 * packages whose versions differ.
 */
function db(): SigDatabase {
	const b = new SigDbBuilder();
	const add = (name: string, deps: readonly Dep[] = [], fns: readonly string[] = [`${name}fn`]) => {
		b.addPackage(name, { latest: '1.0.0' });
		b.addVersion(name, '1.0.0', { ...ver(fns.map(expFn)), dependencies: [...deps] });
	};
	add('leaf');
	add('other');
	add('dependent', [depends('R'), depends('leaf'), { name: 'other', type: DepType.Suggests }, { name: 'other', type: DepType.Enhances }, { name: 'other', type: DepType.LinkingTo }]);
	add('chainA', [depends('chainB')]);
	add('chainB', [depends('chainC')]);
	add('chainC');
	add('cycA', [depends('cycB')]);
	add('cycB', [depends('cycA')]);
	add('diamond', [depends('chainB'), depends('chainC')]);
	add('importer', [imports('leaf')]);
	add('deepImporter', [imports('importer'), depends('chainC')]);
	add('masker', [depends('leaf')], ['leaffn']);
	add('dplyr');
	add('ggplot2');
	b.addPackage('tidyverse', { latest: '2.0.0' });
	b.addVersion('tidyverse', '1.1.1', { ...ver([expFn('tidyverse_update')]), dependencies: [imports('dplyr')] });
	b.addVersion('tidyverse', '2.0.0', { ...ver([expFn('tidyverse_update')]), dependencies: [imports('dplyr'), imports('importer')] });
	b.addPackage('versioned', { latest: '2.0.0' });
	b.addVersion('versioned', '1.0.0', { ...ver([expFn('old')]), dependencies: [depends('leaf')] });
	b.addVersion('versioned', '2.0.0', { ...ver([expFn('new')]), dependencies: [depends('other')] });
	return SigDatabase.fromMemory(b.build({ date: '2026-05-23', generated: 0 }));
}

const overriding = (versions: Record<string, string>) => FlowrConfig.amend(FlowrConfig.default(), c => {
	c.solver.sigdb.versionOverrides = versions;
});
const shape = (layers: readonly Environment[]) => layers.map(l => [l.n, l.t]);
const names = (layer: Environment | undefined) => [...layer?.memory.keys() ?? []].map(k => Identifier.getName(k as unknown as Identifier));
/** the `search()` entries below the global environment, innermost first */
const searchPath = (df: DataflowInformation) => [...REnvironment.searchPath(df.environment.current)].filter(l => l.t !== EnvType.Imports).map(l => l.n);

/** the built-in functions the (first) call named `callName` calls, sorted */
function callTargets(df: DataflowInformation, callName: string): string[] {
	const call = df.graph.vertices(true).find(([, v]) => DfgVertex.isFunctionCall(v) && Identifier.getName(v.name) === callName);
	const edges = call ? df.graph.outgoingEdges(call[0]) : undefined;
	return [...edges ?? []].filter(([to, e]) => NodeId.isBuiltIn(to) && DfEdge.includesType(e, EdgeType.Calls)).map(([to]) => String(to)).sort();
}

async function analyze(ts: TreeSitterExecutor, code: string, source: PackageSignatureSource = db(), config?: FlowrConfig, setup?: (analyzer: FlowrAnalyzer) => void): Promise<DataflowInformation> {
	const analyzer = await sigdbAnalyzer(ts, source, config);
	setup?.(analyzer);
	analyzer.addRequest(code);
	return analyzer.dataflow();
}

describe('Dataflow.library answers what library(pkg) does', withTreeSitter(ts => {
	async function ctxOf(config?: FlowrConfig, setup?: (analyzer: FlowrAnalyzer) => void) {
		const analyzer = await sigdbAnalyzer(ts, db(), config);
		setup?.(analyzer);
		return analyzer.context();
	}

	function libraryCase(name: string, pkg: string, attaches: readonly string[], loads: readonly string[]) {
		test(label(name, ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf();
			expect(Dataflow.library.attaches(ctx, pkg)).toEqual(attaches);
			const loaded = Dataflow.library.loads(ctx, pkg);
			expect(loaded[0]).toBe(pkg);
			expect([...loaded].sort()).toEqual([...loads].sort());
		});
	}

	/* the search() orders below are what R 4.6.1 shows for packages with the same DESCRIPTION */
	describe('what is attached and loaded', () => {
		libraryCase('a package without dependencies attaches and loads only itself', 'leaf', ['leaf'], ['leaf']);
		libraryCase('Depends is attached below the package, Suggests/Enhances/LinkingTo and R are neither attached nor loaded', 'dependent', ['dependent', 'leaf'], ['dependent', 'leaf']);
		libraryCase('Imports is loaded, not attached', 'importer', ['importer'], ['importer', 'leaf']);
		libraryCase('a Depends chain attaches transitively, each package above what it depends on', 'chainA', ['chainA', 'chainB', 'chainC'], ['chainA', 'chainB', 'chainC']);
		libraryCase('a Depends cycle stays finite', 'cycA', ['cycA', 'cycB'], ['cycA', 'cycB']);
		libraryCase('a diamond attaches and loads every package once', 'diamond', ['diamond', 'chainB', 'chainC'], ['diamond', 'chainB', 'chainC']);
		libraryCase('Imports of Imports are loaded, only the own Depends are attached', 'deepImporter', ['deepImporter', 'chainC'], ['deepImporter', 'importer', 'chainC', 'leaf']);
		libraryCase('the newest version is used by default', 'versioned', ['versioned', 'other'], ['versioned', 'other']);
	});

	describe('meta-packages', () => {
		test(label('a meta-package attaches its core set above itself, also where the database does not resolve it', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf();
			const core = metaPackageCore('tidyverse');
			expect(Dataflow.library.attaches(ctx, 'tidyverse')).toEqual([...core].reverse().concat('tidyverse'));
			const layers = Dataflow.library.layers(ctx, 'tidyverse');
			expect(layers.find(l => l.n === 'dplyr')?.t).toBe(EnvType.Namespace);
			expect(layers.find(l => l.n === 'lubridate')?.t).toBe(EnvType.LoadedNamespace);
			const loads = Dataflow.library.loads(ctx, 'tidyverse');
			expect(loads[0]).toBe('tidyverse');
			expect(loads).toEqual(expect.arrayContaining([...core, 'importer', 'leaf']));
			expect(new Set(loads).size).toBe(loads.length);
		});

		test(label('the core set follows the version', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf(overriding({ tidyverse: '1.1.1' }));
			expect(Dataflow.library.attaches(ctx, 'tidyverse')).toEqual(['dplyr', 'purrr', 'readr', 'tidyr', 'tibble', 'ggplot2', 'tidyverse']);
		});

		test(label('the core set follows the version', ['library-loading'], []), () => {
			expect(metaPackageCore('tidyverse', '1.3.2')).not.toContain('lubridate');
			expect(metaPackageCore('tidyverse', '2.0.0')).toContain('lubridate');
			expect(metaPackageCore('tidyverse', '9.9.9')).toEqual(metaPackageCore('tidyverse'));
			expect(metaPackageCore('dplyr')).toEqual([]);
		});

		test(label('library(tidyverse) in an analysis resolves a core package that has no database entry back to the call', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const df = await analyze(ts, 'library(tidyverse)\nlubridate::ymd(x)');
			expect(searchPath(df)).toContain('lubridate');
		});
	});

	describe('versions', () => {
		test(label('a version override changes what is attached and loaded', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf(overriding({ versioned: '1.0.0' }));
			expect(ctx.deps.getDependency('versioned')?.resolvedVersion).toBe('1.0.0');
			expect(Dataflow.library.loads(ctx, 'versioned')).toEqual(['versioned', 'leaf']);
			expect(Dataflow.library.attaches(ctx, 'versioned')).toEqual(['versioned', 'leaf']);
		});

		test(label('library(pkg) in an analysis attaches the Depends of the resolved version', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const path = searchPath(await analyze(ts, 'library(versioned)', db(), overriding({ versioned: '1.0.0' })));
			expect(path).toContain('leaf');
			expect(path).not.toContain('other');
		});
	});

	describe('the search path library(pkg) builds in an analysis', () => {
		test(label('a package masks what it depends on', ['library-loading', 'search-path'], ['dataflow']), async() => {
			expect(callTargets(await analyze(ts, 'library(masker)\nleaffn()'), 'leaffn')).toEqual(['built-in:masker:leaffn']);
		});

		test(label('pos places the package, its Depends still go to the top', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const path = searchPath(await analyze(ts, 'library(other)\nlibrary(dependent, pos = 3)'));
			expect(path.slice(0, 3)).toEqual(['leaf', 'dependent', 'other']);
		});

		test(label('an already attached Depends stays where it is', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const path = searchPath(await analyze(ts, 'library(leaf)\nlibrary(other)\nlibrary(dependent)'));
			expect(path.slice(0, 3)).toEqual(['dependent', 'other', 'leaf']);
		});

		test(label('include.only attaches nothing alongside', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const path = searchPath(await analyze(ts, 'library(dependent, include.only = "dependentfn")'));
			expect(path).toContain('dependent');
			expect(path).not.toContain('leaf');
		});

		test(label('loading a namespace attaches nothing, not even what it depends on', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const df = await analyze(ts, 'requireNamespace("dependent")\nleaffn()');
			expect(callTargets(df, 'leaffn')).toEqual([]);
		});
	});

	describe('the layers', () => {
		test(label('every attached package contributes a namespace layer and an imports layer below it', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const layers = Dataflow.library.layers(await ctxOf(), 'chainB');
			expect(shape(layers)).toEqual([
				['chainB', EnvType.Namespace], ['chainB', EnvType.Imports], ['chainC', EnvType.Namespace], ['chainC', EnvType.Imports]
			]);
			expect(names(layers[0])).toEqual(['chainBfn']);
			expect(names(layers[2])).toEqual(['chainCfn']);
		});

		test(label('the layers are those library(pkg) builds in an analysis', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const analyzer = await sigdbAnalyzer(ts, db());
			analyzer.addRequest('library(diamond)');
			const analyzed = [...REnvironment.searchPath((await analyzer.dataflow()).environment.current)];
			const asked = Dataflow.library.layers(analyzer.context(), 'diamond');
			expect(shape(analyzed.slice(0, asked.length))).toEqual(shape(asked));
			expect(analyzed.slice(0, asked.length).map(names)).toEqual(asked.map(names));
		});

		test(label('asking leaves the project untouched', ['library-loading'], ['dataflow']), async() => {
			const ctx = await ctxOf();
			Dataflow.library.layers(ctx, 'diamond');
			expect(ctx.deps.getDependencies().map(d => d.name)).not.toContain('diamond');
			expect([...REnvironment.searchPath(ctx.env.makeCleanEnv().current)]).toEqual([]);
		});

		test(label('a namespace load or a partial attach can be asked for as well', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf();
			expect(Dataflow.library.attaches(ctx, 'dependent', { namespaceOnly: true })).toEqual([]);
			expect(shape(Dataflow.library.layers(ctx, 'dependent', { namespaceOnly: true }))).toEqual([['dependent', EnvType.LoadedNamespace]]);
			expect(Dataflow.library.attaches(ctx, 'dependent', { include: new Map([['dependentfn', 'dependentfn']]) })).toEqual(['dependent']);
		});

		test(label('the imports layer holds what the NAMESPACE imports, not what those packages import', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf(undefined, a => addPackages(a,
				namespacePackage('nsA', 'export(fa)\nimport(nsB)', ['fa']),
				namespacePackage('nsB', 'export(fb)\nimport(nsC)', ['fb']),
				namespacePackage('nsC', 'export(fc)', ['fc'])));
			const imported = names(Dataflow.library.layers(ctx, 'nsA')[1]).join(' ');
			expect(imported).toContain('fb');
			expect(imported).not.toContain('fc');
			expect(Dataflow.library.loads(ctx, 'nsA')).toEqual(['nsA', 'nsB', 'nsC']);
		});
	});

	describe('without the signature database', () => {
		test(label('an unknown package is recorded as loaded, with no bindings', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf();
			const layers = Dataflow.library.layers(ctx, 'nosuchpkg');
			expect(shape(layers)).toEqual([['nosuchpkg', EnvType.LoadedNamespace]]);
			expect(names(layers[0])).toEqual([]);
			expect(Dataflow.library.attaches(ctx, 'nosuchpkg')).toEqual(['nosuchpkg']);
			expect(Dataflow.library.loads(ctx, 'nosuchpkg')).toEqual(['nosuchpkg']);
		});

		test(label('a declared dependency without resolved exports is recorded as loaded', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf(undefined, a => addPackages(a, new Package({ name: 'declaredonly' })));
			expect(shape(Dataflow.library.layers(ctx, 'declaredonly'))).toEqual([['declaredonly', EnvType.LoadedNamespace]]);
			expect(Dataflow.library.loads(ctx, 'declaredonly')).toEqual(['declaredonly']);
		});

		test(label('what flowR states about a package is attached', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf();
			const stated = [...ctx.env.builtIns.packageMemory.keys()].find(p => !ctx.deps.signatures().has(p));
			expect(stated).toBeDefined();
			const layers = Dataflow.library.layers(ctx, stated as string);
			expect(layers.map(l => l.n)).toEqual([stated]);
			expect(names(layers[0]).length).toBeGreaterThan(0);
			expect(Dataflow.library.attaches(ctx, stated as string)).toEqual([stated]);
		});

		test(label('a NAMESPACE file flowR read contributes its imports', ['library-loading', 'search-path'], ['dataflow']), async() => {
			const ctx = await ctxOf(undefined, a => addPackages(a, namespacePackage('nspkg', 'export(f)\nimport(leaf)\nimportFrom(chainC,chainCfn)', ['f'])));
			expect(Dataflow.library.loads(ctx, 'nspkg')).toEqual(['nspkg', 'leaf', 'chainC']);
			const layers = Dataflow.library.layers(ctx, 'nspkg');
			expect(shape(layers)).toEqual([['nspkg', EnvType.Namespace], ['nspkg', EnvType.Imports]]);
			expect(names(layers[0])).toEqual(['f']);
			expect(names(layers[1]).join(' ')).toMatch(/leaffn.*chainCfn|chainCfn.*leaffn/);
		});
	});
}));

describe('a library() call that may not run only maybe attaches', withTreeSitter(ts => {
	/* `pkgB` and `pkgX` both export `f`, so which `f()` calls says which attach R may have done */
	const both = (a: FlowrAnalyzer) => addPackages(a, namespacePackage('pkgB', 'export(f)', ['f']), namespacePackage('pkgX', 'export(f)', ['f']), namespacePackage('pkgF', 'export(filter)', ['filter']));
	const B = 'built-in:pkgB:f', X = 'built-in:pkgX:f';

	function conditionalCase(name: string, code: string, expected: readonly string[]) {
		test(label(name, ['library-loading', 'search-path', 'if', 'resolve-arguments'], ['dataflow']), async() => {
			expect(callTargets(await analyze(ts, `${code}\nf()`, fakeSigDb({}), undefined, both), 'f')).toEqual([...expected].sort());
		});
	}

	conditionalCase('an unconditional attach shadows', 'library(pkgB)\nlibrary(pkgX)', [X]);
	conditionalCase('an attach in an if without else may not shadow', 'library(pkgB)\nif(u) library(pkgX)', [B, X]);
	conditionalCase('an attach in an if with braces may not shadow', 'library(pkgB)\nif(u) { library(pkgX) }', [B, X]);
	conditionalCase('an attach in only one branch may not shadow', 'library(pkgB)\nif(u) library(pkgX) else 1', [B, X]);
	conditionalCase('the same attach in both branches shadows', 'library(pkgB)\nif(u) library(pkgX) else library(pkgX)', [X]);
	conditionalCase('different attaches in the branches leave both', 'if(u) library(pkgX) else library(pkgB)', [B, X]);
	conditionalCase('a later unconditional attach makes it definite', 'library(pkgB)\nif(u) library(pkgX)\nlibrary(pkgX)', [X]);
	conditionalCase('a loop body may not run', 'library(pkgB)\nfor(i in v) library(pkgX)', [B, X]);
	conditionalCase('a while body may not run', 'library(pkgB)\nwhile(u) library(pkgX)', [B, X]);
	conditionalCase('a function attaching when called attaches definitely when called so', 'g <- function() library(pkgX)\nlibrary(pkgB)\ng()', [X]);
	conditionalCase('a function attaching when called only maybe attaches when called in a branch', 'g <- function() library(pkgX)\nlibrary(pkgB)\nif(u) g()', [B, X]);
	conditionalCase('a function attaching only in a branch maybe attaches', 'g <- function() if(v) library(pkgX)\nlibrary(pkgB)\ng()', [B, X]);
	conditionalCase('detach uncovers what the package masked', 'library(pkgB)\nlibrary(pkgX)\ndetach("package:pkgX")', [B]);
	conditionalCase('detach takes the entry as a symbol', 'library(pkgB)\nlibrary(pkgX)\ndetach(package:pkgX)', [B]);
	conditionalCase('detach without an argument detaches the topmost entry', 'library(pkgB)\nlibrary(pkgX)\ndetach()', [B]);
	conditionalCase('detach takes a position', 'library(pkgB)\nlibrary(pkgX)\ndetach(2)', [B]);
	conditionalCase('detach of the lower package keeps the upper one', 'library(pkgB)\nlibrary(pkgX)\ndetach("package:pkgB")', [X]);
	conditionalCase('a detach in a branch only maybe detaches', 'library(pkgB)\nlibrary(pkgX)\nif(u) detach("package:pkgX")', [B, X]);
	conditionalCase('unloadNamespace detaches as well', 'library(pkgB)\nlibrary(pkgX)\nunloadNamespace("pkgX")', [B]);
	conditionalCase('a package attached again after detach is on top again', 'library(pkgX)\nlibrary(pkgB)\ndetach("package:pkgX")\nlibrary(pkgX)', [X]);
	conditionalCase('a condition known to hold attaches definitely', 'library(pkgB)\nif(TRUE) library(pkgX)', [X]);
	conditionalCase('a condition known to fail does not attach', 'library(pkgB)\nif(FALSE) library(pkgX)', [B]);

	/* each attaches one package after the other, as their sources show, so the last one is searched first */
	conditionalCase('pacman::p_load attaches every package it is given', 'pacman::p_load(pkgB, pkgX)', [X]);
	conditionalCase('pacman::p_load takes strings, and its options are no packages', 'pacman::p_load("pkgB", install = FALSE)', [B]);
	conditionalCase('pacman::p_load takes a vector in char', 'pkgs <- c("pkgB", "pkgX")\npacman::p_load(char = pkgs)', [X]);
	conditionalCase('p_load once pacman is attached', 'library(pacman)\np_load(pkgX)', [X]);
	conditionalCase('librarian::shelf strips the GitHub user', 'librarian::shelf(user/pkgX, "user/pkgB")', [B]);
	conditionalCase('xfun::pkg_attach evaluates its arguments', 'xfun::pkg_attach("pkgB", "pkgX")', [X]);
	conditionalCase('xfun::pkg_attach takes a vector', 'xfun::pkg_attach(c("pkgX", "pkgB"))', [B]);
	conditionalCase('xfun::pkg_attach2 looks up a variable', 'pkgs <- "pkgX"\nxfun::pkg_attach2(pkgs)', [X]);
	conditionalCase('easypackages::libraries attaches as well', 'easypackages::libraries("pkgX")', [X]);
	conditionalCase('library(character.only = TRUE) takes a vector', 'p <- "pkgX"\nlibrary(p, character.only = TRUE)', [X]);

	/** the code the backward slice for the last line keeps */
	async function sliceOf(code: string): Promise<string> {
		const analyzer = await sigdbAnalyzer(ts, fakeSigDb({}));
		both(analyzer);
		analyzer.addRequest(code);
		const last = code.split('\n').length;
		const { 'static-slice': slices } = await analyzer.query([{ type: 'static-slice', criteria: [`${last}@f`] }]);
		const kept = (Object.values(slices.results)[0] as { reconstruct?: { code: string | string[] } } | undefined)?.reconstruct?.code;
		return Array.isArray(kept) ? kept.join('\n') : kept ?? '';
	}

	/* each attach is needed: without it R calls the other package's f, or none */
	for(const [name, code, needed] of [
		['an export read as a value', 'library(pkgX)\ng <- f\ng()\nf()', 'library(pkgX)'],
		['an attach through lapply', 'library(pkgB)\nlapply("pkgX", library, character.only = TRUE)\nf()', 'lapply('],
		['an attach through sapply with require', 'library(pkgB)\nsapply("pkgX", require, character.only = TRUE)\nf()', 'sapply('],
		['an attach through do.call', 'library(pkgB)\ndo.call(library, list("pkgX"))\nf()', 'do.call('],
		['an attach through a function held by a variable', 'library(pkgB)\nl <- library\nl(pkgX)\nf()', 'l(pkgX)'],
		['an attach in a local with another environment', 'library(pkgB)\ne <- new.env()\nlocal(library(pkgX), envir = e)\nf()', 'local('],
		['an attach within a function called later', 'g <- function() library(pkgX)\nlibrary(pkgB)\ng()\nf()', 'g()'],
		['a package masking a built-in a function body calls', 'g <- function() filter(1)\nlibrary(pkgF)\nf <- g()', 'library(pkgF)']
	] as const) {
		test(label(`the slice keeps ${name}`, ['library-loading', 'search-path', 'functions-with-global-side-effects'], ['dataflow', 'slice']), async() => {
			expect(await sliceOf(code)).toContain(needed);
		});
	}

	test(label('an export read as a value depends on the library() call attaching it', ['library-loading', 'search-path', 'name-normal'], ['dataflow', 'slice']), async() => {
		const df = await analyze(ts, 'library(pkgX)\ng <- f\nprint(g())', fakeSigDb({}), undefined, both);
		expect(df.graph.hasVertex(X)).toBe(true);
		const loader = df.graph.vertices(true).find(([, v]) => DfgVertex.isFunctionCall(v) && Identifier.getName(v.name) === 'library')?.[0];
		expect(df.graph.outgoingEdges(X)?.has(loader ?? '')).toBe(true);
	});

	test(label('a loader records every package it attaches on the search path', ['library-loading', 'search-path'], ['dataflow']), async() => {
		const df = await analyze(ts, 'pacman::p_load(pkgB, "pkgX")\nxfun::pkg_attach(c("a", "b"))', fakeSigDb({}), undefined, both);
		for(const pkg of ['pkgB', 'pkgX', 'a', 'b']) {
			expect(Resolve.byName(AmbientStateName.keyed(KeyedState.SearchPath, pkg), df.environment)?.length, pkg).toBeGreaterThan(0);
		}
	});

	test(label('a maybe definition in a nested frame is kept next to the definite one it may shadow', ['if', 'name-normal', 'lexicographic-scope'], ['dataflow']), async() => {
		const df = await analyze(ts, 'x <- 2\nlocal({ if(u) x <- 1\nprint(x) })', fakeSigDb({}));
		const use = df.graph.vertices(true).find(([id, v]) => DfgVertex.isUse(v) && NodeId.recoverName(id, df.graph.idMap) === 'x');
		const reads = Dataflow.targetsOf(df.graph, use?.[0] ?? '', EdgeType.Reads);
		expect(reads).toHaveLength(2);
	});

	test(label('a maybe definition in a function does not hide the global one it may shadow', ['if', 'name-normal', 'global-scope'], ['dataflow']), async() => {
		const df = await analyze(ts, 'x <- 2\ng <- function() { if(u) x <- 1\nx }\ng()', fakeSigDb({}));
		const use = df.graph.vertices(true).find(([id, v]) => DfgVertex.isUse(v) && NodeId.recoverName(id, df.graph.idMap) === 'x');
		/* the local one is read directly, the global one once the call links the closure */
		const reads = Dataflow.targetsOf(df.graph, use?.[0] ?? '', EdgeType.Reads | EdgeType.DefinedByOnCall);
		expect(reads).toHaveLength(2);
	});
}));
