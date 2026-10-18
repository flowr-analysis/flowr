import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { EdgeType } from '../../../dataflow/graph/edge';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { Identifier } from '../../../dataflow/environments/identifier';
import { type DataflowGraphVertexFunctionCall, VertexType } from '../../../dataflow/graph/vertex';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import { NodeValue } from '../../../dataflow/eval/resolve/node-value';
import { Resolve } from '../../../dataflow/environments/resolve-helper';
import type { AstIdMap, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionCall, EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import { type CmdCheckResult, isBuiltInCall, packageInfo } from './cmd-check-util';

export type NamespaceTamperingKind =
	/** `unlockBinding` of a binding in another namespace */
	| 'unlock-binding'
	/** `assignInNamespace` into another namespace */
	| 'assign-in-namespace'
	/** a call of R's internals through `.Internal` */
	| 'internal'
	/** `library.dynam` naming the file extension of the shared object */
	| 'shared-object-extension';

export interface NamespaceTamperingResult extends CmdCheckResult {
	readonly kind:       NamespaceTamperingKind
	/** the namespace tampered with, if known */
	readonly namespace?: string
	/** for `.Internal`, the internal function called */
	readonly internal?:  string
}

export interface NamespaceTamperingConfig extends MergeableRecord {
	/** report `.Internal` calls (default `true`) */
	readonly checkInternal: boolean
}

export type NamespaceTamperingMetadata = MergeableRecord;

/** the calls this rule is about, which spares resolving every other call */
const TamperingCalls: ReadonlySet<string> = new Set(['unlockBinding', 'assignInNamespace', '.Internal', 'library.dynam', 'library.dynam.unload']);

/** the calls that name a namespace by the package name they are handed */
const NamespaceGetters: ReadonlySet<string> = new Set(['asNamespace', 'getNamespace', 'loadNamespace']);


/** the package a namespace argument names, `'own'` for the package's own one, `undefined` if unknown */
function namespaceOf(node: RNode<ParentInformation> | undefined, info: ResolveInfo, own: string | undefined, depth = 0): string | 'own' | undefined {
	if(node === undefined) {
		return undefined;
	}
	if(RArgument.is(node)) {
		return namespaceOf(node.value, info, own, depth);
	}
	let name: string | undefined;
	if(RFunctionCall.isNamed(node)) {
		const fn = Identifier.getName(node.functionName.content);
		if(fn === 'topenv' || fn === 'environment') {
			return 'own';
		}
		if(!NamespaceGetters.has(fn) || node.arguments.length < 1 || node.arguments[0] === EmptyArgument) {
			return undefined;
		}
		name = NodeValue.singleStringOf(node.arguments[0].value?.info.id, info);
	} else {
		/* `assignInNamespace` also takes the package name itself */
		name = NodeValue.singleStringOf(node.info.id, info);
		if(name === undefined && RSymbol.is(node)) {
			return namespaceOfVariable(node, info, own, depth);
		}
	}
	return name === undefined ? undefined : name === own ? 'own' : name;
}

/** the namespace a variable is bound to, if every definition reaching it binds the same one (`ns <- asNamespace("x")`) */
function namespaceOfVariable(node: RSymbol<ParentInformation>, info: ResolveInfo, own: string | undefined, depth: number): string | 'own' | undefined {
	const graph = info.graph;
	const idMap = graph?.idMap;
	if(graph === undefined || idMap === undefined || depth > 8) {
		return undefined;
	}
	const answers = new Set<string | undefined>();
	for(const def of Dataflow.targetsOf(graph, node.info.id, EdgeType.Reads)) {
		const target = idMap.get(def);
		const assignment = target?.info.parent === undefined ? undefined : idMap.get(target.info.parent);
		const value = RBinaryOp.is(assignment) ? (assignment.lhs === target ? assignment.rhs : assignment.rhs === target ? assignment.lhs : undefined) : undefined;
		answers.add(value === undefined ? undefined : namespaceOf(value, info, own, depth + 1));
	}
	return answers.size === 1 ? [...answers][0] : undefined;
}

/** whether the call is the one a `.Internal` call is handed, which is reported with the `.Internal` */
function isInternalArgument(node: RNode<ParentInformation>, idMap: AstIdMap): boolean {
	const arg = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
	const call = arg?.info.parent === undefined ? undefined : idMap.get(arg.info.parent);
	return RFunctionCall.isNamed(call, '.Internal');
}

/**
 * Port of the `R CMD check` notes on calls that tamper with R or other packages
 * (`checking R code for possible problems`): `tools:::.check_package_code_tampers`
 * ("Found the following possibly unsafe calls"), `.check_dotInternal` ("Found .Internal call(s)"),
 * and `.check_package_code_shlib`.
 */
export const NAMESPACE_TAMPERING = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const df = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const info = Resolve.info(df.graph, ctx);
		const results: NamespaceTamperingResult[] = [];
		const add = (node: RNode<ParentInformation>, result: Omit<NamespaceTamperingResult, 'loc' | 'involvedId' | 'certainty'>, certain = true) => {
			const loc = SourceLocation.fromNode(node);
			if(loc !== undefined) {
				results.push({ certainty: certain ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain, involvedId: node.info.id, loc, ...result });
			}
		};
		for(const [id, vertex] of df.graph.verticesOfType(VertexType.FunctionCall)) {
			const name = Identifier.getName(vertex.name);
			const node = TamperingCalls.has(name) ? idMap.get(id) : undefined;
			if(node === undefined || !pkg.isPackageCode(node.info.file) || !isBuiltInCall(df.graph, id)) {
				continue;
			}
			const call = vertex as DataflowGraphVertexFunctionCall;
			const arg = (formals: Record<string, string>, formal: string) => {
				const ids = FunctionSemantics.call.match.toSpec(call.args, formals).get(formal);
				return ids?.length === 1 ? idMap.get(ids[0]) : undefined;
			};
			switch(name) {
				case 'unlockBinding': {
					if(isInternalArgument(node, idMap)) {
						break;
					}
					const ns = namespaceOf(arg({ sym: 'sym', env: 'env' }, 'env'), info, pkg.name);
					if(ns !== 'own') {
						add(node, {
							kind:    'unlock-binding',
							...(ns !== undefined ? { namespace: ns } : {}),
							message: `unlockBinding() ${ns === undefined ? 'of a binding outside of the package' : `in the namespace of '${ns}'`} changes code the package does not own`
						}, ns !== undefined);
					}
					break;
				}
				case 'assignInNamespace': {
					const ns = namespaceOf(arg({ x: 'x', value: 'value', ns: 'ns', pos: 'pos', envir: 'envir' }, 'ns'), info, pkg.name);
					if(ns !== 'own') {
						add(node, {
							kind:    'assign-in-namespace',
							...(ns !== undefined ? { namespace: ns } : {}),
							message: `assignInNamespace() ${ns === undefined ? 'into a namespace outside of the package' : `into the namespace of '${ns}'`} changes code the package does not own`
						}, ns !== undefined);
					}
					break;
				}
				case '.Internal': {
					if(!config.checkInternal) {
						break;
					}
					const inner = RFunctionCall.is(node) && node.arguments[0] !== EmptyArgument ? node.arguments[0]?.value : undefined;
					const internal = RFunctionCall.isNamed(inner) ? Identifier.getName(inner.functionName.content) : undefined;
					add(node, {
						kind:    internal === 'unlockBinding' ? 'unlock-binding' : 'internal',
						...(internal !== undefined ? { internal } : {}),
						message: internal === 'unlockBinding'
							? '.Internal(unlockBinding()) circumvents the protection of locked bindings'
							: `.Internal(${internal ?? ''}) calls R's internals, which are not part of R's API and may change without notice`
					});
					break;
				}
				case 'library.dynam': case 'library.dynam.unload': {
					const chname = arg({ chname: 'chname', package: 'package', 'lib.loc': 'lib.loc' }, 'chname');
					const value = RArgument.is(chname) ? chname.value : chname;
					const str = value === undefined ? undefined : NodeValue.singleStringOf(value.info.id, info);
					if(str !== undefined && /\.(so|sl|dll)$/.test(str)) {
						add(node, {
							kind:    'shared-object-extension',
							message: `${name}() is handed '${str}', but expects the name of the shared object without its platform-specific extension`
						});
					}
					break;
				}
			}
		}
		return { results, '.meta': {} };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.kind}${result.namespace ? ` of ${result.namespace}` : ''} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:          'Namespace Tampering',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Robustness, LintingRuleTag.Security],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Port of the `R CMD check` notes *"Found the following possibly unsafe calls"* (`unlockBinding` and `assignInNamespace` on other namespaces), *"Found .Internal call(s)"*, and on `library.dynam` calls naming the shared object with its extension (all `checking R code for possible problems`). Where `R CMD check` compares the written argument with the package name, flowR resolves the namespace and package names through variables and reports an unknown namespace as uncertain.',
		defaultConfig: () => ({
			checkInternal: true
		})
	}
} as const satisfies LintingRule<NamespaceTamperingResult, NamespaceTamperingMetadata, NamespaceTamperingConfig>;
