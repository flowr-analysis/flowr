import path from 'path';
import { escapeRegex } from '../../../util/text/strings';
import { baseRExportOwner } from '../../../util/r-base-packages';
import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { Identifier } from '../../../dataflow/environments/identifier';
import { namesWith } from '../../linter-util';
import { ArgProp, SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import { FileRole } from '../../../project/context/flowr-file';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { EmptyArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { printer, type CmdCheckResult, type PackageInfo, isStandardPackage, projectNodes } from './cmd-check-util';
import type { PackageFiles } from './package-files';
import { onPackageFiles } from './file-checks';
import { packageCode } from './package-code';

export type PackageRuntimeKind =
	/** `export(x)` of something the package does not define, which fails the installation ("undefined exports") */
	| 'undefined-export'
	/** `S3method(gen, cls)` without a function `gen.cls`, which fails loading the namespace */
	| 'missing-s3-method'
	/** a NAMESPACE import from a package not in Imports or Depends ("Namespace dependency missing from DESCRIPTION Imports/Depends entries") */
	| 'undeclared-namespace-import'
	/** `importFrom(pkg, f)` of a name `pkg` does not export, which fails loading the namespace */
	| 'unexported-import'
	/** `library(pkg)` of the package itself in its own code, which fails when it is not on the library search path */
	| 'self-attach'
	/** test code `R CMD check` never runs, or that runs the tests of another package */
	| 'test-runner'
	/** test or vignette code that does not parse, so running it fails */
	| 'syntax'
	/** a vignette without the metadata R needs to find and build it */
	| 'vignette-metadata'
	/** test or vignette code writing a file into the working directory, which `R CMD check` notes as left behind */
	| 'check-directory-write'
	/** a `tests/*.Rout.save` without the test it is the expected output of */
	| 'orphan-reference-output'
	/** Rust code without the SystemRequirements CRAN asks for */
	| 'rust-requirements'
	/** a package without a NAMESPACE file, which no package may be since R 3.0.0 */
	| 'missing-namespace'
	/** a DESCRIPTION `Type` other than `Package` */
	| 'extension-type'
	/** an installed package (or a build left inside the sources) handed to the check instead of a source package */
	| 'not-source-package';

export interface PackageRuntimeResult extends CmdCheckResult {
	readonly kind: PackageRuntimeKind
}

export interface PackageRuntimeConfig extends MergeableRecord {
	/** report writes of tests and vignettes into the working directory (default `true`) */
	readonly checkWrites: boolean
}

export type PackageRuntimeMetadata = MergeableRecord;

/** calls binding names in ways a scan of the assignments does not see, so an export may be defined after all */
const DynamicDefiners: ReadonlySet<string> = new Set(['assign', 'delayedAssign', 'makeActiveBinding', 'eval', 'evalq', 'sys.source', 'list2env', 'source']);

interface Definitions {
	readonly names:   ReadonlySet<string>
	/** whether the code may define names that no assignment states */
	readonly dynamic: boolean
	/**
	 * whether the top level calls a function of another package, which may define what it likes (R.oo's
	 * `setMethodS3("f", "cls", ...)` defines `f.cls`), so nothing can be said about what is undefined
	 */
	readonly opaque:  boolean
}

/** the names the top level of the package code binds, including the generics `setGeneric` creates */
function definitionsOf(ast: NormalizedAst, pkg: PackageInfo, data: readonly string[], declaring: ReadonlySet<string>): Definitions {
	const names = new Set<string>(data);
	let dynamic = false;
	const topLevelCalls: string[] = [];
	const idMap = ast.idMap;
	for(const node of projectNodes(ast)) {
		if(!pkg.isPackageCode(node.info.file)) {
			continue;
		}
		if(RFunctionCall.isNamed(node)) {
			const fn = Identifier.getName(node.functionName.content);
			const parentNode = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
			if(RExpressionList.is(parentNode) && parentNode.info.parent === undefined) {
				topLevelCalls.push(fn);
			}
			const first = node.arguments[0] === EmptyArgument ? undefined : node.arguments[0]?.value;
			if((fn === 'setGeneric' || fn === 'setRefClass' || fn === 'setClass') && RString.is(first)) {
				names.add(first.content.str);
			} else if(fn === 'assign' && RString.is(first)) {
				names.add(first.content.str);
			} else if(DynamicDefiners.has(fn)) {
				dynamic = true;
			}
			continue;
		}
		if(!RBinaryOp.is(node) || !['<-', '=', '->', '<<-'].includes(node.operator)) {
			continue;
		}
		const parent = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
		if(parent !== undefined && !(RExpressionList.is(parent) && parent.info.parent === undefined)) {
			continue;
		}
		const target = node.operator === '->' ? node.rhs : node.lhs;
		if(RSymbol.is(target)) {
			names.add(Identifier.getName(target.content));
		} else if(RString.is(target)) {
			names.add(target.content.str);
		}
	}
	return { names, dynamic, opaque: topLevelCalls.some(fn => !names.has(fn) && baseRExportOwner(fn) === undefined && !declaring.has(fn) && fn !== 'assign') };
}

/** the line of the first NAMESPACE directive matching, to point a finding at it */
function lineMatching(text: string | undefined, pattern: RegExp): number | undefined {
	const line = text?.split(/\r?\n/).findIndex(l => !l.trimStart().startsWith('#') && pattern.test(l));
	return line === undefined || line < 0 ? undefined : line + 1;
}

/** the line of the first NAMESPACE directive mentioning `name` */
function lineOf(text: string | undefined, name: string): number | undefined {
	return lineMatching(text, new RegExp(`(^|[(,\\s"'\`])${escapeRegex(name)}([)\\s,"'\`]|$)`));
}

/** the first row with a syntax error, `undefined` if the code parses */
function syntaxErrorRow(code: string, data: ReadonlyFlowrAnalysisProvider): number | undefined {
	try {
		const tree = data.parseStandalone(code);
		if(!tree.rootNode.hasError) {
			return undefined;
		}
		const stack = [tree.rootNode];
		for(let node = stack.pop(); node !== undefined; node = stack.pop()) {
			if(node.isError || node.isMissing) {
				return node.startPosition.row;
			}
			stack.push(...node.children.toReversed());
		}
		return 0;
	} catch{
		return undefined;
	}
}

/** whether a literal path stays out of the working directory: the temporary directory or an absolute path elsewhere is fine for this */
function writesIntoWorkingDirectory(file: string): boolean {
	return file !== '' && !path.isAbsolute(file) && !file.startsWith('~') && !/^[a-z]+:\/\//i.test(file) && file !== 'stdout' && file !== 'stderr';
}

function namespaceChecks(files: PackageFiles, pkg: PackageInfo, defs: Definitions, data: ReadonlyFlowrAnalysisProvider, add: (r: Omit<PackageRuntimeResult, 'involvedId'>) => void): void {
	const ns = pkg.namespace;
	const nsFile = data.inspectContext().files.getFilesByRole(FileRole.Namespace)[0];
	if(ns === undefined || nsFile === undefined) {
		return;
	}
	const text = nsFile.rawText?.();
	const relative = path.relative(files.root, nsFile.path()).split(path.sep).join('/');
	if(defs.opaque) {
		return;
	}
	const certainty = defs.dynamic ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain;
	/* a package may export what it imports (`importFrom(magrittr, "%>%")` and `export("%>%")`) */
	const imported = new Set([...ns.importedPackages.values()].flatMap(v => v === 'all' ? [] : v));
	const importsWhole = [...ns.importedPackages.values()].includes('all');
	for(const name of [...ns.exportedSymbols, ...ns.exportedFunctions]) {
		if(!defs.names.has(name) && !imported.has(name) && !importsWhole) {
			add({ certainty, loc: files.locate(relative, lineOf(text, name)), kind: 'undefined-export', message: `undefined export: '${name}', installing the package fails` });
		}
	}
	for(const [generic, classes] of ns.exportS3Generics) {
		for(const cls of classes) {
			const fun = ns.s3MethodFunctions?.get(`${generic}.${cls}`) ?? `${generic}.${cls}`;
			if(!defs.names.has(fun)) {
				add({ certainty, loc: files.locate(relative, lineMatching(text, new RegExp(`S3method\\(\\s*["'\`]?${escapeRegex(generic)}["'\`]?\\s*,\\s*["'\`]?${escapeRegex(cls)}\\b`))), kind: 'missing-s3-method', message: `S3method(${generic}, ${cls}) registers '${fun}', which the package does not define, so loading its namespace fails` });
			}
		}
	}
	const declared = new Set([...pkg.declared.get('Imports') ?? [], ...pkg.declared.get('Depends') ?? []]);
	const sources = data.inspectContext().deps.signatureSources();
	for(const [imported, names] of ns.importedPackages) {
		if(imported === pkg.name) {
			continue;
		}
		if(!declared.has(imported) && !isStandardPackage(imported)) {
			add({ certainty: LintingResultCertainty.Certain, loc: files.locate(relative, lineOf(text, imported)), kind: 'undeclared-namespace-import', message: `Namespace dependency missing from DESCRIPTION Imports/Depends entries: '${imported}'` });
		}
		const known = sources.find(s => s.has(imported))?.lookup(imported);
		if(names === 'all' || known === undefined) {
			continue;
		}
		for(const name of names) {
			if(!known.exported.includes(name)) {
				add({
					certainty: known.internal.includes(name) ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain,
					loc:       files.locate(relative, lineOf(text, name)),
					kind:      'unexported-import',
					message:   `'${name}' is not exported by 'namespace:${imported}', so loading the namespace fails`
				});
			}
		}
	}
}

function testAndVignetteChecks(files: PackageFiles, pkg: PackageInfo, data: ReadonlyFlowrAnalysisProvider, config: PackageRuntimeConfig, writers: ReadonlyMap<string, ReadonlySet<string>>, add: (r: Omit<PackageRuntimeResult, 'involvedId'>) => void): void {
	const entries = files.entries.filter(e => !e.isDirectory).map(e => e.relative);
	const testFiles = entries.filter(f => /^tests\/[^/]+\.[rR]$/.test(f));
	const testthatFiles = entries.filter(f => /^tests\/testthat\/test[^/]*\.[rR]$/.test(f));
	if(testthatFiles.length > 0 && testFiles.length === 0) {
		add({ certainty: LintingResultCertainty.Certain, loc: files.locate(testthatFiles[0]), kind: 'test-runner', message: 'tests/testthat/ has tests, but no tests/*.R runs them (e.g. tests/testthat.R calling test_check()), so R CMD check never does' });
	}
	for(const save of entries.filter(f => /^tests\/[^/]+\.Rout\.save$/.test(f))) {
		if(!entries.includes(save.replace(/\.Rout\.save$/, '.R')) && !entries.includes(save.replace(/\.Rout\.save$/, '.r'))) {
			add({ certainty: LintingResultCertainty.Certain, loc: files.locate(save), kind: 'orphan-reference-output', message: `${save} is the expected output of a test that does not exist` });
		}
	}
	for(const code of packageCode(files)) {
		if(code.origin === 'examples') {
			continue;
		}
		const row = syntaxErrorRow(code.code, data);
		if(row !== undefined) {
			add({ certainty: LintingResultCertainty.Certain, loc: files.locate(code.file, row + code.lineOffset), kind: 'syntax', message: `the ${code.origin === 'tests' ? 'test' : 'vignette'} code in ${code.file} does not parse, so running it fails` });
			continue;
		}
		let ast: NormalizedAst;
		try {
			ast = data.normalizeStandalone(code.code);
		} catch{
			continue;
		}
		RProject.visitAst(ast.ast, node => {
			if(!RFunctionCall.isNamed(node)) {
				return false;
			}
			const fn = Identifier.getName(node.functionName.content);
			const at = (n: RNode<ParentInformation>) => files.locate(code.file, (SourceLocation.getRange(SourceLocation.fromNode(n) ?? SourceLocation.invalid())[0]) + code.lineOffset - 1);
			const strings = node.arguments.flatMap(a => a !== EmptyArgument && RString.is(a.value) ? [a.value.content.str] : []);
			if(fn === 'test_check' && strings.length > 0 && pkg.name !== undefined && strings[0] !== pkg.name) {
				add({ certainty: LintingResultCertainty.Certain, loc: at(node), kind: 'test-runner', message: `test_check("${strings[0]}") runs the tests of another package than '${pkg.name}'` });
			} else if(config.checkWrites && writers.has(fn)) {
				const named = node.arguments.find(a => a !== EmptyArgument && a.name !== undefined && writers.get(fn)?.has(Identifier.getName(a.name.content)));
				const second = node.arguments[1];
				const file = named !== undefined && named !== EmptyArgument ? named.value : second !== undefined && second !== EmptyArgument ? second.value : undefined;
				if(RString.is(file) && writesIntoWorkingDirectory(file.content.str)) {
					add({ certainty: LintingResultCertainty.Uncertain, loc: at(node), kind: 'check-directory-write', message: `${fn}() writes '${file.content.str}' into the working directory, which R CMD check notes as left behind; write to tempdir() instead` });
				}
			}
			return false;
		});
		if(code.origin === 'vignettes' && !/\.R$/i.test(code.file)) {
			const text = files.read(code.file) ?? '';
			if(!/\\VignetteIndexEntry\{/.test(text)) {
				add({ certainty: LintingResultCertainty.Certain, loc: files.locate(code.file), kind: 'vignette-metadata', message: `${code.file} has no %\\VignetteIndexEntry{}, so R does not list it` });
			}
			if(!/\.Rnw$/i.test(code.file) && !/\\VignetteEngine\{/.test(text)) {
				add({ certainty: LintingResultCertainty.Certain, loc: files.locate(code.file), kind: 'vignette-metadata', message: `${code.file} has no %\\VignetteEngine{}, so R does not build it (only Sweave is the default)` });
			}
		}
	}
	const rust = entries.find(f => /^src\/(rust\/)?Cargo\.toml$/.test(f));
	const requirements = (pkg.description?.content().get('SystemRequirements') ?? []).join(' ');
	if(rust !== undefined && !/cargo/i.test(requirements)) {
		add({ certainty: LintingResultCertainty.Certain, loc: files.locate('DESCRIPTION'), kind: 'rust-requirements', message: `the package compiles Rust (${rust}) but SystemRequirements names no Cargo/rustc` });
	}
}

/**
 * The static part of the `R CMD check` steps that build, install, load, or run the package: what makes installing
 * or loading the namespace fail, what keeps tests and vignettes from running, and what they leave behind.
 */
export const PACKAGE_RUNTIME = {
	createSearch:        () => Q.from([]),
	processSearchResult: onPackageFiles({}, async(files, pkg, config, data) => {
		const ctx = data.inspectContext();
		const results: PackageRuntimeResult[] = [];
		const add = (r: Omit<PackageRuntimeResult, 'involvedId'>) => results.push({ ...r, involvedId: undefined });
		const ast = ctx.files.hasRequests() ? await data.normalize() : undefined;
		const dataObjects = files.entries.filter(e => !e.isDirectory && e.relative.startsWith('data/')).map(e => path.posix.basename(e.relative).replace(/\..*$/, ''));
		if(ast !== undefined) {
			namespaceChecks(files, pkg, definitionsOf(ast, pkg, dataObjects, namesWith(ctx.env.builtInIndex, SemanticCallTag.Declares)), data, add);
			const ownName = pkg.name;
			const attaching = namesWith(ctx.env.builtInIndex, SemanticCallTag.AttachesPackage);
			for(const node of projectNodes(ast)) {
				if(ownName !== undefined && pkg.isPackageCode(node.info.file) && RFunctionCall.isNamed(node, attaching)) {
					const arg = node.arguments[0] === EmptyArgument ? undefined : node.arguments[0]?.value;
					const name = RSymbol.is(arg) ? Identifier.getName(arg.content) : RString.is(arg) ? arg.content.str : undefined;
					const loc = SourceLocation.fromNode(node);
					if(name === ownName && loc !== undefined) {
						add({ certainty: LintingResultCertainty.Certain, loc, kind: 'self-attach', message: `the package attaches itself with ${Identifier.getName(node.functionName.content)}(${ownName}), which fails when it is loaded without being on the library search path` });
					}
				}
			}
		}
		const relativeFiles = new Set(files.entries.map(e => e.relative));
		/* only a listing of the whole folder can tell that a file is missing */
		if(files.onDisk && !relativeFiles.has('NAMESPACE')) {
			add({ certainty: LintingResultCertainty.Certain, loc: files.locate('DESCRIPTION'), kind: 'missing-namespace', message: 'the package has no NAMESPACE file, which all packages need as from R 3.0.0' });
		}
		const type = pkg.description?.content().get('Type')?.[0]?.trim();
		if(type !== undefined && type !== 'Package') {
			add({ certainty: LintingResultCertainty.Certain, loc: files.locate('DESCRIPTION'), kind: 'extension-type', message: `the DESCRIPTION states Type: ${type}, but only packages (Type: Package) can be checked` });
		}
		const installed = ['Meta/package.rds', `R/${pkg.name ?? ''}.rdb`, 'R/all.rda'].find(f => relativeFiles.has(f));
		if(installed !== undefined) {
			add({ certainty: LintingResultCertainty.Certain, loc: files.locate(installed), kind: 'not-source-package', message: `${installed} belongs to an installed package, R CMD check needs the package sources` });
		}
		const index = ctx.env.builtInIndex;
		const writers = new Map<string, Set<string>>(namesWith(index, SemanticCallTag.Writes).values().map(n => [n, new Set<string>()]));
		for(const p of index.params(ArgProp.Resource)) {
			writers.get(Identifier.getName(p.call))?.add(p.name);
		}
		testAndVignetteChecks(files, pkg, data, config, writers, add);
		return { results, '.meta': {} };
	}),
	prettyPrint: printer<PackageRuntimeResult>(r => r.kind),
	info:        {
		name:          'Package Runtime',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds what makes installing, loading, or running the package fail without doing so: undefined exports, S3 methods without a function, bad NAMESPACE imports, a package attaching itself, tests that never run, test or vignette code that does not parse, missing vignette metadata, and files written into the working directory.',
		defaultConfig: () => ({
			checkWrites: true
		})
	}
} as const satisfies LintingRule<PackageRuntimeResult, PackageRuntimeMetadata, PackageRuntimeConfig>;

