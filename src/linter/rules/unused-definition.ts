import { type LintingResult, type LintingRule, type LintQuickFix, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { edgeTargets } from '../../dataflow/fn/frame-reflection';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { F } from '../../search/flowr-search-filters';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { AstIdMap, NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { FileRole } from '../../project/context/flowr-file';
import { getExportedNames } from '../../project/plugins/file-plugins/files/flowr-namespace-file';
import { Identifier } from '../../dataflow/environments/identifier';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { removeRQuotes } from '../../r-bridge/retriever';
import type { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import { callFnProps } from '../../dataflow/environments/query-fn-props';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { CallProp, ImpureProps } from '../../dataflow/environments/built-in-props';
import { RGroupGenerics, s3GroupGenericMembers } from '../../dataflow/environments/group-generics';
import { EmptyArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { DataflowInformation } from '../../dataflow/info';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';

export interface UnusedDefinitionResult extends LintingResult {
	variableName?: string
}

export interface UnusedDefinitionConfig extends MergeableRecord {
	/**
	 * Whether to include (potentially anonymous) function definitions in the search (e.g., should we report uncalled anonymous functions?).
	 */
	includeFunctionDefinitions: boolean
	/**
	 * Whether to suppress definitions that the analyzed project exports via its `NAMESPACE` (the package's public API).
	 * flowR cannot observe external callers, so exported names would otherwise be reported as (uncertain) false positives.
	 */
	excludeExportedDefinitions: boolean
}

/**
 * The dots parameter is a special parameter and must never be reported as an unused definition.
 */
const DotsParameter = '...';

/** the standard-library S3 generics flowR models no built-in for, so the store cannot state them */
const OtherKnownS3Generics: ReadonlySet<string> = new Set([
	'summary', 'coef', 'vcov', 'residuals', 'fitted', 'predict', 'as.vector', 'str', 'toString', 'all.equal',
	'aggregate', 'update', 'anova', 'confint', 'logLik', 'AIC', 'BIC', 'deviance', 'df.residual',
	'model.matrix', 'terms', 'weights', 'merge', 'split', 'window'
]);

/**
 * The generics a definition named `name.class` may be an S3 method for: the built-ins flowR labels
 * {@link CallProp.Generic} plus {@link OtherKnownS3Generics}. Such a method is dispatched indirectly
 * (`print(x)` on an object of that class), so it is used without a textual call. Kept per configuration,
 * as a process-wide memo would let the first analyzer's built-ins answer for every later one.
 */
function knownS3Generics(index: BuiltInIndex): ReadonlySet<string> {
	return new Set([...OtherKnownS3Generics, ...Object.keys(RGroupGenerics),
		...index.with(CallProp.Generic).map(g => Identifier.getName(g))]);
}

/** Whether `generic`, or any member of it when it is a group generic (`Ops.cls` dispatches on `+`), is called. */
function isDispatched(generic: string, called: ReadonlySet<string>): boolean {
	const group = s3GroupGenericMembers(generic);
	return called.has(generic) || (group?.some(member => called.has(member)) ?? false);
}

/**
 * R package lifecycle hooks called automatically by R's package machinery.
 * These functions are invoked by the package system, so they are used even without textual callers.
 */
const PackageHookFunctions = new Set<string>([
	'.onLoad', '.onAttach', '.onUnload', '.onDetach', '.Last.lib', '.First.lib'
]);

interface PackageInfo {
	/** all names the project exports via its `NAMESPACE` (functions, symbols, patterns, S3 methods as `generic.class`) */
	readonly exported:   ReadonlySet<string>
	/** S3 generics the project's `NAMESPACE` declares methods for (via `S3method(generic, class)`) */
	readonly s3Generics: ReadonlySet<string>
}

/** Gathers the analyzed project's own `NAMESPACE` exports and declared S3 generics (empty when it is not a package). */
function collectPackageInfo(data: ReadonlyFlowrAnalysisProvider): PackageInfo {
	const namespaces = data.inspectContext().files.getFilesByRole(FileRole.Namespace).map(ns => ns.content().current);
	return {
		exported:   new Set(namespaces.flatMap(getExportedNames)),
		s3Generics: new Set(namespaces.flatMap(info => [...info.exportS3Generics.keys()]))
	};
}

/** Collects the names of every function call in the graph, so we can tell whether an S3 generic is dispatched anywhere. */
export function collectCalledNames(dfg: DataflowGraph): ReadonlySet<string> {
	return new Set(dfg.verticesOfType(VertexType.FunctionCall).map(([, vertex]) => Identifier.getName(vertex.name)));
}

/** S3 (`UseMethod`) and S4/S7 (`standardGeneric`) generic dispatchers, invoked indirectly by R's dispatch. */
const GenericDispatchers = new Set<string>(['UseMethod', 'standardGeneric']);

/** Whether a function body is a single call to a generic dispatcher. */
function isGenericDispatcherOnlyBody(node: RNode<ParentInformation>): boolean {
	const isDispatcherCall = (n: RNode<ParentInformation> | undefined) =>
		RFunctionCall.isNamed(n, GenericDispatchers);
	return isDispatcherCall(node) || (RExpressionList.is(node) && node.children.length === 1 && isDispatcherCall(node.children[0]));
}

/** Collects the parameter IDs of generic dispatcher functions, which hand them on to their methods. */
function collectS3GenericParameterIds(ast: NormalizedAst): ReadonlySet<NodeId> {
	return new Set(ast.idMap.values().flatMap(node =>
		RFunctionDefinition.is(node) && isGenericDispatcherOnlyBody(node.body) ? node.parameters.map(param => param.name.info.id) : []));
}

/** Whether `name` reads as `generic.class` for a generic that is known, declared, or called, so R dispatches to it by that name. */
export function isS3MethodName(name: string, ctx: ReadOnlyFlowrAnalyzerContext, called: ReadonlySet<string>, declared: ReadonlySet<string> = new Set()): boolean {
	/* every dot may be the one splitting method from class, as the generic may carry dots itself (`as.character.foo`) */
	for(let dot = name.indexOf('.'); dot > 0; dot = name.indexOf('.', dot + 1)) {
		const generic = name.slice(0, dot);
		if(ctx.env.deriveFromIndex(knownS3Generics).has(generic) || declared.has(generic) || isDispatched(generic, called)) {
			return true;
		}
	}
	return false;
}

/**
 * A definition is treated as used (and hence not reported) if it is the dots parameter, a package lifecycle hook,
 * an S3 method for a dispatched generic, or - when {@link UnusedDefinitionConfig#excludeExportedDefinitions} is set -
 * a package export.
 */
function isConsideredUsed(lexeme: string | undefined, config: UnusedDefinitionConfig, pkg: PackageInfo, called: ReadonlySet<string>, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	if(lexeme === undefined) {
		return false;
	}
	/* non-syntactic definition names (e.g. S3 methods like `"[.irts"`) carry their R quotes or backticks in the lexeme */
	const unquoted = removeRQuotes(lexeme);
	const name = unquoted.length > 1 && unquoted.startsWith('`') && unquoted.endsWith('`') ? unquoted.slice(1, -1) : unquoted;
	/* the dots are a special parameter, and package lifecycle hooks are called by R's package machinery */
	if(name === DotsParameter || PackageHookFunctions.has(name)) {
		return true;
	}
	return isS3MethodName(name, ctx, called, pkg.s3Generics) || (config.excludeExportedDefinitions && pkg.exported.has(name));
}

export interface UnusedDefinitionMetadata extends MergeableRecord {
	totalConsidered: number
}

const InterestingEdgesVariable = EdgeType.Reads | EdgeType.Calls | EdgeType.DefinesOnCall;
/* include read as this could print the function definition */
const InterestingEdgesFunction = EdgeType.Reads | EdgeType.Calls;
const InterestingEdgesTargets = EdgeType.SideEffectOnCall;

/**
 * Whether the node names a parameter of a function whose signature something outside the code fixes: a package
 * lifecycle hook R calls with a set of arguments, or an S3 method a generic dispatches to. Such a parameter is
 * unused only in the sense that this body ignores it, which is no reason to change what the function accepts.
 */
function hasContractedSignature(
	node: RNode<ParentInformation>,
	ast: NormalizedAst,
	config: UnusedDefinitionConfig,
	pkg: PackageInfo,
	called: ReadonlySet<string>,
	ctx: ReadOnlyFlowrAnalyzerContext
): boolean {
	let inParameter = false;
	for(const parent of RNode.iterateParents(node, ast.idMap)) {
		inParameter ||= RParameter.is(parent);
		if(RFunctionDefinition.is(parent)) {
			/* the name the definition is bound under is what reaches it, so that is what the contract goes by */
			const bound = RNode.directParent(parent, ast.idMap);
			/* a function handed to a call is called by it, like a `tryCatch` handler or an `lapply` callback */
			if(RArgument.is(bound)) {
				return inParameter;
			}
			const name = RBinaryOp.is(bound) ? bound.lhs.lexeme
				: RFunctionCall.is(bound) && bound.arguments[0] !== EmptyArgument ? bound.arguments[0]?.lexeme : undefined;
			return inParameter && name !== undefined && isConsideredUsed(name, config, pkg, called, ctx);
		}
	}
	return false;
}

/**
 * Whether the call states an effect beyond computing a value, which is what makes dropping the statement around
 * it a change to what the program does: `res <- write.csv(x, f)` writes the file whether or not `res` is read.
 * `binds` is the assignment being removed, whose own {@link CallProp.Scope} is the binding this is all about and
 * so says nothing; the same property on a call within it, as `assign` states, is an effect of its own.
 */
function doesMoreThanCompute(id: NodeId, df: Pick<DataflowInformation, 'graph' | 'environment'>, binds: NodeId | undefined): boolean {
	if(!DfgVertex.isFunctionCall(df.graph.getVertex(id))) {
		return false;
	}
	/* what a call that binds the very name in question does to that name is not what keeps it alive */
	const worthKeeping = id === binds ? { props: ImpureProps.props & ~CallProp.Scope, tags: ImpureProps.tags } : ImpureProps;
	return FunctionSemantics.call.props.hasAny(callFnProps(id, df), worthKeeping);
}

function getAssignmentPeer(node: RNode<ParentInformation>, ast: NormalizedAst): { statement: RNode<ParentInformation>, value: RNode<ParentInformation> } | undefined {
	const parent = RNode.directParent(node, ast.idMap);
	if(!RBinaryOp.is(parent)) {
		return undefined;
	}
	if(parent.lhs.info.id === node.info.id) {
		return { statement: parent, value: parent.rhs };
	}
	if(parent.rhs.info.id === node.info.id) {
		return { statement: parent, value: parent.lhs };
	}
	return undefined;
}

function yieldsFunctionValue(node: RNode<ParentInformation>, ast: NormalizedAst, dfg: DataflowGraph): boolean {
	const path = new Set<NodeId>([node.info.id]);
	for(const up of RNode.iterateParents(node, ast.idMap)) {
		if(RFunctionDefinition.is(up)) {
			const fn = dfg.getVertex(up.info.id);
			return DfgVertex.isFunctionDefinition(fn) && fn.exitPoints.some(e => path.has(e.nodeId));
		}
		path.add(up.info.id);
	}
	return false;
}

function isStandaloneStatement(node: RNode<ParentInformation>, ast: NormalizedAst): boolean {
	if(node.info.role !== RoleInParent.ExpressionListChild) {
		return false;
	}
	const parent = RNode.directParent(node, ast.idMap);
	if(!RExpressionList.is(parent)) {
		return false;
	}
	const opening = RExpressionList.groupStart(parent);
	return opening === undefined || opening.lexeme === '{';
}

/** Whether the definition's value has obligations, like side effects, so the definition cannot be removed. */
function hasImportantArgs(definedBys: readonly NodeId[], df: Pick<DataflowInformation, 'graph' | 'environment'>, binds: NodeId | undefined): boolean {
	const dfg = df.graph;
	return definedBys.some(d => dfg.unknownSideEffects.has(d) || doesMoreThanCompute(d, df, binds)
		|| dfg.edgesTo(d).values().some(edge => DfEdge.includesType(edge, InterestingEdgesTargets))
		|| dfg.edgesFrom(d).entries().some(([target, edge]) => DfEdge.includesType(edge, InterestingEdgesTargets) || dfg.unknownSideEffects.has(target)));
}

function buildQuickFix(variable: RNode<ParentInformation>, df: Pick<DataflowInformation, 'graph' | 'environment'>, ast: NormalizedAst): LintQuickFix[] | undefined {
	const dfg = df.graph;
	// first we check whether any of the 'Defined by' targets have any obligations - if so, we can not remove the definition
	// otherwise we can automatically remove the full definition!
	if(variable.info.role === RoleInParent.Accessed || variable.info.role === RoleInParent.ForVariable) {
		// this is an access or a for variable, we can not remove it currently
		return undefined;
	}
	const definedBys = edgeTargets(dfg, variable.info.id, EdgeType.DefinedBy);
	if(hasImportantArgs(definedBys, df, variable.info.parent)) {
		return undefined;
	}
	const assignment = getAssignmentPeer(variable, ast);
	const totalRangeToRemove = SourceLocation.merge([
		...definedBys.map(d => SourceLocation.fromNode(ast.idMap.get(d))),
		SourceLocation.fromNode(assignment?.value),
		variable.info.fullRange ?? variable.location
	]);
	if(totalRangeToRemove === undefined) {
		/* a fix that names no place cannot be carried out, so none is offered */
		return undefined;
	}
	const description = `Remove unused definition of \`${variable.lexeme}\``;
	const statement = assignment?.statement ?? variable;
	if(isStandaloneStatement(statement, ast)) {
		return yieldsFunctionValue(statement, ast, dfg) ? undefined : [{ type: 'remove', loc: totalRangeToRemove, description }];
	}
	const replacement = RNode.lexeme(assignment?.value);
	return replacement === undefined ? undefined : [{ type: 'replace', loc: totalRangeToRemove, replacement, description }];
}

/**
 * consider `x <- function() ...` if we say `x` is unused and propose to remove everything, there should be no separate quick fix for the function definition
 */
function onlyKeepSupersetOfUnused(elements: UnusedDefinitionResult[]): UnusedDefinitionResult[] {
	const locs = elements.flatMap(e => e.quickFix?.map(q => q.loc) ?? [e.loc]);
	if(locs.length <= 1) {
		return elements; // nothing to filter, only one element
	}
	return elements.filter(e => {
		const otherLoc = SourceLocation.merge((e.quickFix?.map(q => q.loc) ?? [e.loc])) ?? SourceLocation.invalid();
		return !locs.some(r => SourceLocation.compare(r, otherLoc) !== 0 && SourceLocation.isSubsetOf(otherLoc, r)); // there is no smaller remove
	});
}

/** Whether the node sits inside a promise, i.e. an argument default value or a `delayedAssign` body, which may never run. */
function isWithinPromise(node: RNode<ParentInformation>, idMap: AstIdMap): boolean {
	let child = node;
	for(const parent of RNode.iterateParents(node, idMap)) {
		if((RParameter.is(parent) && parent.defaultValue?.info.id === child.info.id)
			|| (RFunctionCall.isNamed(parent, 'delayedAssign'))) {
			return true;
		}
		child = parent;
	}
	return false;
}

export const UNUSED_DEFINITION = {
	createSearch: config => Q.all().filter(
		config.includeFunctionDefinitions ? F.or(VertexType.VariableDefinition, VertexType.FunctionDefinition) : VertexType.VariableDefinition),
	processSearchResult: async(elements, config, data): Promise<{ results: UnusedDefinitionResult[], '.meta': UnusedDefinitionMetadata }> => {
		const normalize = await data.normalize();
		const dataflow = await data.dataflow();
		const graph = dataflow.graph;
		const ctx = data.inspectContext();
		const packageInfo = collectPackageInfo(data);
		const calledNames = collectCalledNames(graph);
		const s3GenericParams = collectS3GenericParameterIds(normalize);
		const metadata: UnusedDefinitionMetadata = {
			totalConsidered: 0
		};
		const isUnused = (node: RNode<ParentInformation>): boolean => {
			if(isWithinPromise(node, normalize.idMap)) {
				return false;
			}
			const vertex = graph.getVertex(node.info.id);
			if(!vertex || (!DfgVertex.isVariableDefinition(vertex) && DfgVertex.isFunctionDefinition(vertex) && !config.includeFunctionDefinitions)) {
				return false;
			}
			if(s3GenericParams.has(node.info.id)) {
				return false;
			}
			// an anonymous dispatcher passed to setGeneric()/new_generic() runs on every dispatch, so it is used
			if(DfgVertex.isFunctionDefinition(vertex) && RFunctionDefinition.is(node) && isGenericDispatcherOnlyBody(node.body)) {
				return false;
			}
			if(isConsideredUsed(node.lexeme, config, packageInfo, calledNames, ctx)) {
				return false;
			}
			/* what calls a hook or dispatches to a method decides its parameters, so they are no more the
			   author's to drop than the name is: `print.foo` keeps the `x` the generic hands it */
			if(hasContractedSignature(node, normalize, config, packageInfo, calledNames, ctx)) {
				return false;
			}
			const interestedIn = DfgVertex.isVariableDefinition(vertex) ? InterestingEdgesVariable : InterestingEdgesFunction;
			return !graph.edgesTo(vertex.id).values().some(e => DfEdge.includesType(e, interestedIn));
		};
		return {
			results: onlyKeepSupersetOfUnused(elements.getElements().flatMap(({ node }) => {
				metadata.totalConsidered++;
				if(!isUnused(node)) {
					return [];
				}
				return [{
					certainty:    LintingResultCertainty.Uncertain,
					variableName: node.lexeme,
					involvedId:   node.info.id,
					loc:          SourceLocation.fromNode(node) ?? SourceLocation.invalid(),
					quickFix:     buildQuickFix(node, dataflow, normalize)
				}] satisfies UnusedDefinitionResult[];
			})),
			'.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Definition of \`${result.variableName}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Definition of \`${result.variableName}\` at ${SourceLocation.format(result.loc)} is unused`
	},
	info: {
		name:          'Unused Definitions',
		description:   'Checks for unused definitions.',
		tags:          [LintingRuleTag.Readability, LintingRuleTag.Smell, LintingRuleTag.QuickFix],
		// our limited analysis causes unused definitions involving complex reflection etc. not to be included in our result, but unused definitions are correctly validated
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: () => ({
			includeFunctionDefinitions: true,
			excludeExportedDefinitions: true
		})
	}
} as const satisfies LintingRule<UnusedDefinitionResult, UnusedDefinitionMetadata, UnusedDefinitionConfig>;
