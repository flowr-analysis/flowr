import { RS3Generics } from '../../../data/r-s3-generics.generated';
import { type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { Identifier } from '../../../dataflow/environments/identifier';
import { fnInfo } from '../../../dataflow/environments/query-fn-props';
import { CallProp } from '../../../dataflow/environments/built-in-props';
import { callsBuiltIn } from '../../linter-util';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RUnaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { AstIdMap, NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { s3GroupGenericMembers } from '../../../dataflow/environments/group-generics';
import { isExportedInInfo } from '../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { at, type CmdCheckResult, printer, formalNames as rawFormalNames, packageInfo, projectNodes, topLevelDefinitions } from './cmd-check-util';

/** what is wrong with the function */
export type S3MethodIssue =
	/** the method does not take the arguments of its generic */
	| 'argument-mismatch'
	/** an exported method of an exported generic that is no registered S3 method */
	| 'unregistered-method'
	/** a replacement function without `value` as its last argument */
	| 'replacement-value';

export interface S3MethodConsistencyResult extends CmdCheckResult {
	readonly kind:     S3MethodIssue
	/** the offending function, e.g. `print.foo` or `foo<-` */
	readonly function: string
	/** the generic the function is a method of, absent for a replacement function that is no method */
	readonly generic?: string
}

export interface S3MethodConsistencyConfig extends MergeableRecord {
	/** check that methods take the arguments of their generic (default `true`) */
	readonly checkMethods:           boolean
	/** also check functions named like a method but not registered in the `NAMESPACE`, which `R CMD check` only does on request (default `true`) */
	readonly checkApparentMethods:   boolean
	/** report apparent methods of an exported generic that the `NAMESPACE` does not register (default `true`) */
	readonly checkUnregistered:      boolean
	/** check that replacement functions end in `value` (default `true`) */
	readonly checkReplacementValues: boolean
}

export interface S3MethodConsistencyMetadata extends MergeableRecord {
	/** the methods compared with their generic */
	readonly consideredMethods:      number
	/** the replacement functions inspected */
	readonly consideredReplacements: number
}




/** the formals of a definition, without the backticks of non-syntactic names */
function formalNames(def: RFunctionDefinition<ParentInformation>): string[] {
	return rawFormalNames(def).map(n => n.replace(/^`(.*)`$/, '$1'));
}

/** the subsetting generics dispatch internally on an argument list that varies by method, so a method may take any */
const SubsetGenerics: ReadonlySet<string> = new Set(['[', '[[', '$']);

/** the operators for which a method with as many arguments as the generic is fine whatever their names */
const OperatorGenerics: ReadonlySet<string> = new Set(['+', '-', '*', '/', '^', '%%', '%/%', '&', '|', '!', '==', '!=', '<', '<=', '>=', '>']);

/** whether a method with the formals `mArgs` is consistent with the generic `gName` of formals `gArgs` (`tools::checkS3methods`) */
function consistent(gName: string, gArgs: readonly string[], mName: string, mArgs: readonly string[]): boolean {
	if(gName === 'round' && mArgs[0] === 'x') {
		return true;
	}
	/* the second argument of `plot` is not one the methods have to take */
	const generic = gName === 'plot' ? gArgs.filter((_, i) => i !== 1) : gArgs;
	let g = generic;
	let m = mArgs;
	if(mName.endsWith('.formula')) {
		g = g[0] !== '...' ? g.slice(1) : g;
		m = m[0] !== '...' ? m.slice(1) : m;
	}
	const gDots = g.indexOf('...');
	const mDots = m.indexOf('...');
	/* only the arguments before the dots are matched by position */
	const positional = Math.min(gDots < 0 ? g.length : gDots, mDots < 0 ? Infinity : mDots);
	let positionalOk = true;
	for(let i = 0; i < positional; i++) {
		positionalOk &&= g[i] === m[i];
	}
	const takesAll = g.every(a => m.includes(a)) || mDots >= 0;
	const onlyKnown = m.every(a => a === '...' || g.includes(a)) || generic.includes('...');
	return (positionalOk && takesAll && onlyKnown) || (OperatorGenerics.has(gName) && generic.length === mArgs.length);
}

function formatFormals(name: string, formals: readonly string[]): string {
	return `${name}:\n  function(${formals.join(', ')})`;
}

/** the node naming the function a definition is bound to, the definition itself when it is anonymous */
function nameNodeOf(def: RFunctionDefinition<ParentInformation>, idMap: AstIdMap): RNode<ParentInformation> {
	const parent = def.info.parent === undefined ? undefined : idMap.get(def.info.parent);
	return parent !== undefined && RBinaryOp.is(parent) && parent.rhs === def ? parent.lhs : def;
}

interface Generic {
	readonly formals: readonly string[]
	/** defined by the package itself, as opposed to a function of base R */
	readonly local:   boolean
}

/** the package functions that call `UseMethod` on their own account, i.e. the generics the package defines */
function localGenerics(defs: readonly { name: string, def: RFunctionDefinition<ParentInformation> }[], ast: NormalizedAst, graph: DataflowGraph): Map<string, Generic> {
	const idMap = ast.idMap;
	const byId = new Map<NodeId, { name: string, def: RFunctionDefinition<ParentInformation> }>(defs.map(d => [d.def.info.id, d]));
	const generics = new Map<string, Generic>();
	const seen = new Set<NodeId>();
	for(const node of projectNodes(ast)) {
		if(seen.has(node.info.id) || !RFunctionCall.is(node) || !callsBuiltIn(graph, node.info.id, 'UseMethod')) {
			continue;
		}
		seen.add(node.info.id);
		const owner = RNode.strictlyEnclosingFunction(node.info.id, idMap);
		const def = owner === undefined ? undefined : byId.get(owner);
		if(def !== undefined) {
			generics.set(def.name, { formals: formalNames(def.def), local: true });
		}
	}
	return generics;
}

/** the functions and operators the package code calls, by name */
function calledNames(ast: NormalizedAst): Set<string> {
	const called = new Set<string>();
	for(const node of projectNodes(ast)) {
		if(RFunctionCall.isNamed(node)) {
			called.add(Identifier.getName(node.functionName.content));
		} else if(RBinaryOp.is(node) || RUnaryOp.is(node)) {
			called.add(node.operator);
		}
	}
	return called;
}

/**
 * Port of the `R CMD check` checks `checking S3 generic/method consistency` (`tools::checkS3methods`) and
 * `checking replacement functions` (`tools::checkReplaceFuns`).
 * A method must take all the arguments of its generic in the same order (and `...` if the generic does); a replacement
 * function must end in `value`. The methods are the `S3method()` registrations of the `NAMESPACE` (certain) and the
 * functions named `generic.class` for a generic (uncertain, `R CMD check` merely lists these on request). The generics are
 * the package's own functions calling `UseMethod`, the group generics, and the functions flowR knows as generic
 * with their formals; a function flowR knows as an ordinary function (`t.test`) is no method of `t`.
 * Additionally, apparent methods that are exported but not registered are reported.
 */
export const S3_METHOD_CONSISTENCY = {
	createSearch:        () => Q.fromQuery({ type: 'dependencies', enabledCategories: [] }),
	processSearchResult: async(_elements, config, data) => {
		const ctx = data.inspectContext();
		const { graph } = await data.dataflow();
		const ast = await data.normalize();
		const idMap = ast.idMap;
		const pkg = packageInfo(ctx);
		const ns = pkg.namespace;
		const notMethods = new Set(RS3Generics.nonS3Methods[pkg.name ?? ''] ?? []);
		const defs = topLevelDefinitions(ast, () => true).filter(d => pkg.isPackageCode(d.def.info.file));
		const defined = new Set(defs.map(d => d.name));
		const local = localGenerics(defs, ast, graph);
		const generics = new Map<string, Generic>(local);
		/* a function of the package named like a generic of base hides it, unless it is a generic itself */
		const genericNames = new Set(ctx.env.deriveFromIndex(index => index.with(CallProp.Generic).map(g => Identifier.getName(g))));
		for(const name of genericNames) {
			const formals = RS3Generics.genericFormals[name] ?? fnInfo(Identifier.make(name), ctx)?.entry?.signature?.map(p => p.name) ?? [];
			if(!generics.has(name) && !defined.has(name) && !SubsetGenerics.has(name) && formals.length > 0) {
				generics.set(name, { formals, local: false });
			}
		}
		for(const [name, formals] of Object.entries(RS3Generics.groupGenericFormals)) {
			if(!local.has(name) && !defined.has(name)) {
				generics.set(name, { formals, local: false });
			}
		}
		const called = calledNames(ast);
		/* like `R CMD check`, an unregistered method of a generic from base R only matters if the package calls the generic */
		const dispatched = (generic: string) => called.has(generic) || (s3GroupGenericMembers(generic)?.some(m => called.has(m)) ?? false);
		const byLength = [...generics.keys()].sort((a, b) => b.length - a.length);
		const results: S3MethodConsistencyResult[] = [];
		let methods = 0;
		let replacements = 0;
		const report = (def: RFunctionDefinition<ParentInformation>, kind: S3MethodIssue, name: string, generic: string | undefined, certain: boolean, message: string) => {
			results.push({
				...at(nameNodeOf(def, idMap), certain),
				kind,
				function: name,
				...(generic === undefined ? {} : { generic }),
				message
			});
		};
		const registered = (generic: string, name: string) => ns?.exportS3Generics.get(generic)?.includes(name.slice(generic.length + 1)) ?? false;
		/* a function flowR knows as ordinary function of a package (`t.test`) is no method of the generic it starts with */
		const ordinary = (name: string) => {
			const known = fnInfo(Identifier.make(name), ctx);
			return known !== undefined && known.entry?.props.includes('s3-method') !== true;
		};
		const replacementCheck = (def: RFunctionDefinition<ParentInformation>, name: string, generic: string | undefined, certain: boolean) => {
			replacements++;
			const formals = formalNames(def);
			if(formals.length > 0 && formals[formals.length - 1] !== 'value') {
				report(def, 'replacement-value', name, generic, certain, `Replacement function ${name} should have 'value' as its last argument`);
			}
		};
		for(const { name, def } of defs) {
			/* the longest generic wins: `t.test.default` is a method of `t.test`, not of `t` */
			const generic = notMethods.has(name) ? undefined : byLength.find(g => name.length > g.length + 1 && name.startsWith(g + '.'));
			const info = generic === undefined ? undefined : generics.get(generic);
			const isRegistered = generic !== undefined && registered(generic, name);
			if(generic !== undefined && info !== undefined && (isRegistered || info.local || !ordinary(name))) {
				if(config.checkMethods && (isRegistered || (config.checkApparentMethods && (info.local || dispatched(generic))))) {
					methods++;
					const formals = formalNames(def);
					if(!consistent(generic, info.formals, name, formals)) {
						report(def, 'argument-mismatch', name, generic, isRegistered,
							`S3 generic/method inconsistency:\n${formatFormals(generic, info.formals)}\n${formatFormals(name, formals)}`);
					}
				}
				if(config.checkUnregistered && ns !== undefined && !isRegistered && isExportedInInfo(info.local ? generic : name, ns) === true) {
					report(def, 'unregistered-method', name, generic, false,
						`Apparent S3 method ${name} for ${info.local ? 'exported generic' : 'generic'} ${generic} is not registered in the NAMESPACE`);
				}
			}
			if(!config.checkReplacementValues) {
				continue;
			}
			if(name.endsWith('<-') && !(name.startsWith('%') && name.endsWith('%'))) {
				replacementCheck(def, name, undefined, true);
				continue;
			}
			/* a method of a replacement generic (`[<-.cls`) is a replacement function as well, even though its name does not end in `<-` */
			const split = name.indexOf('<-.');
			const replacementGeneric = split > 0 ? name.slice(0, split + 2) : undefined;
			if(replacementGeneric !== undefined && (registered(replacementGeneric, name) || local.has(replacementGeneric) || genericNames.has(replacementGeneric.slice(0, -2)))) {
				replacementCheck(def, name, replacementGeneric, registered(replacementGeneric, name));
			}
		}
		return { results, '.meta': { consideredMethods: methods, consideredReplacements: replacements } };
	},
	prettyPrint: printer<S3MethodConsistencyResult>(r => `${r.function}: ${r.kind}`),
	info:        {
		name:          'S3 Method Consistency',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds S3 methods whose formals do not match their generic, methods not registered in the NAMESPACE, and replacement functions whose last formal is not `value`.',
		defaultConfig: () => ({
			checkMethods:           true,
			checkApparentMethods:   true,
			checkUnregistered:      true,
			checkReplacementValues: true
		})
	}
} as const satisfies LintingRule<S3MethodConsistencyResult, S3MethodConsistencyMetadata, S3MethodConsistencyConfig>;
