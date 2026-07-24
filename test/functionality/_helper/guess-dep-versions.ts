import type { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import type { FlowrConfig } from '../../../src/config';
import { executeQueries } from '../../../src/queries/query';
import type {
	GuessDepVersionsQuery,
	GuessDepVersionsQueryResult,
	GuessedDependency,
	GuessEvidenceSource
} from '../../../src/queries/catalog/guess-dep-versions-query/guess-dep-versions-query-format';
import { SigDbBuilder } from '../../../src/project/sigdb/build';
import { DepType, FnProp, type SigDb, type SigFunctionInfo, type SigVersionInfo } from '../../../src/project/sigdb/schema';
import { RRange, RVersion } from '../../../src/util/r-version';
import { Package } from '../../../src/project/plugins/package-version-plugins/package';
import { expFn, sigTmpDir, sigdbAnalyzer, writeAndOpen } from './sigdb';

/** one version of a package in a scenario: when it was released, which functions (with which parameters) it exports, and what it depends on */
export interface ScenarioVersion {
	/** release date `YYYY-MM-DD` (drives the `date` cutoff and version ordering) */
	readonly date?:      string;
	/** exported function to its parameter names (use `'...'` for a variadic) */
	readonly fns?:       Readonly<Record<string, readonly string[]>>;
	/** declared dependency to its version constraint (e.g. `>= 1.0.0`) */
	readonly deps?:      Readonly<Record<string, string>>;
	readonly cran?:      boolean;
	/** S3 classes this version OWNS (must also be an exported function name in {@link fns}); see {@link FnProp.S3Owner} */
	readonly s3Classes?: readonly string[];
	/** S4 classes this version OWNS (exported via `exportClasses`, need not be a function); see {@link FnProp.S4Owner} */
	readonly s4Classes?: readonly string[];
}

/** a package across its versions */
export interface ScenarioPackage {
	/** the recorded latest version (defaults to the highest given) */
	readonly latest?:    string;
	/** an R-core / base package (its versions are the R releases it shipped with) */
	readonly base?:      boolean;
	readonly downloads?: number;
	readonly versions:   Readonly<Record<string, ScenarioVersion>>;
}

/** a full version-guessing scenario: the signature database, the analyzed code, declared constraints, and the query itself */
export interface GuessScenario {
	readonly code:      string;
	readonly packages:  Readonly<Record<string, ScenarioPackage>>;
	/** declared constraints injected as project dependencies: package to one or several raw constraints */
	readonly declared?: Readonly<Record<string, string | readonly string[]>>;
	readonly query?:    Omit<GuessDepVersionsQuery, 'type'>;
	readonly config?:   FlowrConfig;
}

const dayMs = (date: string): number => {
	const [y, m, d] = date.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
};

const fnInfo = (name: string, params: readonly string[], s3Owner: boolean): SigFunctionInfo =>
	({ ...expFn(name), props: FnProp.Exported | (s3Owner ? FnProp.S3Owner : 0), params: params.map(p => ({ name: p })) });

function versionInfo(v: ScenarioVersion): SigVersionInfo {
	const owned = new Set(v.s3Classes ?? []);
	const functions = Object.entries(v.fns ?? {}).map(([name, params]) => fnInfo(name, params, owned.has(name)));
	// S4 classes are recorded as owner entries carrying the S4Owner bit (mirrors the crawler's synthetic entry)
	for(const cls of v.s4Classes ?? []) {
		functions.push({ ...expFn(cls), props: FnProp.Exported | FnProp.S4Owner });
	}
	return {
		cran: v.cran ?? true,
		functions,
		...(v.deps ? { dependencies: Object.entries(v.deps).map(([name, constraint]) => ({ name, type: DepType.Imports, constraint })) } : {}),
		...(v.date ? { date: dayMs(v.date) } : {})
	};
}

/** turn a declarative scenario into an in-memory {@link SigDb} */
export function buildGuessDb(packages: Readonly<Record<string, ScenarioPackage>>): SigDb {
	const b = new SigDbBuilder();
	for(const [name, spec] of Object.entries(packages)) {
		const versions = Object.keys(spec.versions);
		b.addPackage(name, { latest: spec.latest ?? RVersion.highest(versions) ?? versions[versions.length - 1], core: spec.base ?? false, downloads: spec.downloads ?? 0 });
		for(const [version, v] of Object.entries(spec.versions)) {
			b.addVersion(name, version, versionInfo(v));
		}
	}
	return b.build({ tier: 'full', date: '2026-05-23', generated: 0 });
}

/** build the scenario's database + analyzer, inject declared constraints, and add the code as a request */
export async function buildGuessAnalyzer(ts: TreeSitterExecutor, scenario: GuessScenario): Promise<FlowrAnalyzer> {
	const db = await writeAndOpen(sigTmpDir('guess-db-'), buildGuessDb(scenario.packages));
	const analyzer = await sigdbAnalyzer(ts, db, scenario.config);
	for(const [name, constraints] of Object.entries(scenario.declared ?? {})) {
		const ranges = (typeof constraints === 'string' ? [constraints] : constraints).map(c => RRange.parse(c)).filter(r => r !== undefined);
		analyzer.context().deps.addDependency(new Package({ name, ...(ranges.length > 0 ? { versionConstraints: ranges } : {}) }));
	}
	analyzer.addRequest(scenario.code);
	return analyzer;
}

/** build the scenario's database + analyzer, inject declared constraints, and run the `guess-dep-versions` query */
export async function runGuess(ts: TreeSitterExecutor, scenario: GuessScenario): Promise<GuessDepVersionsQueryResult> {
	const analyzer = await buildGuessAnalyzer(ts, scenario);
	const results = await executeQueries({ analyzer }, [{ type: 'guess-dep-versions', ...scenario.query }]);
	return results['guess-dep-versions'];
}

/** the guessed dependency for `pkg`, or `undefined` if the query did not report it */
export function guessed(result: GuessDepVersionsQueryResult, pkg: string): GuessedDependency | undefined {
	return result.dependencies.find(d => d.package === pkg);
}

/** run the scenario and return just the guess for `pkg` (the common case where a test only asserts on one dependency) */
export async function guessDep(ts: TreeSitterExecutor, scenario: GuessScenario, pkg: string): Promise<GuessedDependency | undefined> {
	return guessed(await runGuess(ts, scenario), pkg);
}

/** the deduplicated `bound` values a given evidence source contributes to a dependency (e.g. every `>=` a signature raised) */
export function boundsFrom(dep: GuessedDependency | undefined, source: GuessEvidenceSource): string[] {
	return [...new Set((dep?.evidence ?? []).filter(e => e.source === source).map(e => e.bound).filter((b): b is string => b !== undefined))];
}
