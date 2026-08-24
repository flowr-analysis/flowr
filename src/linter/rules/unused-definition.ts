import { type LintingResult, type LintingRule, type LintQuickFixRemove, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { isNotUndefined } from '../../util/assert';
import { FunctionCallVertex, FunctionDefinitionVertex, VariableDefinitionVertex, VertexType } from '../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { F } from '../../search/flowr-search-filters';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { AstIdMap, NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { FileRole } from '../../project/context/flowr-file';
import { getExportedNames } from '../../project/plugins/file-plugins/files/flowr-namespace-file';
import { Identifier } from '../../dataflow/environments/identifier';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { removeRQuotes } from '../../r-bridge/retriever';
import { BuiltInIndex, callFnProps  } from '../../dataflow/environments/query-fn-props';
import { CallProp, ImpureProps } from '../../dataflow/environments/built-in-props';
import { RGroupGenerics, s3GroupGenericMembers } from '../../dataflow/environments/group-generics';
import { EmptyArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { DataflowInformation } from '../../dataflow/info';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { NoEdges } from '../../dataflow/graph/graph';
import { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';

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

let knownS3Generics: ReadonlySet<string> | undefined;

/**
 * Whether a definition named `name.class` may be an S3 method: `name` is a built-in flowR labels
 * {@link CallProp.Generic} or one of {@link OtherKnownS3Generics}. Such a method is dispatched indirectly
 * (`print(x)` on an object of that class), so it is used without a textual call.
 */
function isKnownS3Generic(name: string): boolean {
	knownS3Generics ??= new Set([...OtherKnownS3Generics, ...Object.keys(RGroupGenerics),
		...BuiltInIndex.default().with(CallProp.Generic).map(g => Identifier.getName(g))]);
	return knownS3Generics.has(name);
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
	const exported = new Set<string>();
	const s3Generics = new Set<string>();
	for(const ns of data.inspectContext().files.getFilesByRole(FileRole.Namespace)) {
		const info = ns.content().current;
		for(const name of getExportedNames(info)) {
			exported.add(name);
		}
		for(const generic of info.exportS3Generics.keys()) {
			s3Generics.add(generic);
		}
	}
	return { exported, s3Generics };
}

/** Collects the names of every function call in the graph, so we can tell whether an S3 generic is dispatched anywhere. */
function collectCalledNames(dfg: DataflowGraph): ReadonlySet<string> {
	const names = new Set<string>();
	for(const [, vertex] of dfg.verticesOfType(VertexType.FunctionCall)) {
		names.add(Identifier.getName(vertex.name));
	}
	return names;
}

/** S3 (`UseMethod`) and S4/S7 (`standardGeneric`) generic dispatchers, invoked indirectly by R's dispatch. */
const GenericDispatchers = new Set<string>(['UseMethod', 'standardGeneric']);

/** Whether a function body is a single call to a generic dispatcher. */
function isGenericDispatcherOnlyBody(node: RNode<ParentInformation>): boolean {
	if(RFunctionCall.isNamed(node) && GenericDispatchers.has(Identifier.getName(node.functionName.content))) {
		return true;
	}

	const nodeWithChildren = node as Record<string, unknown>;
	if(Array.isArray(nodeWithChildren.children) && nodeWithChildren.children.length === 1) {
		const child = nodeWithChildren.children[0] as RNode<ParentInformation> | undefined;
		if(child && RFunctionCall.isNamed(child) && GenericDispatchers.has(Identifier.getName(child.functionName.content))) {
			return true;
		}
	}

	return false;
}

/** Collects the parameter IDs of generic dispatcher functions. */
function collectS3GenericParameterIds(ast: NormalizedAst): ReadonlySet<NodeId> {
	const paramIds = new Set<NodeId>();
	for(const [, node] of ast.idMap) {
		if(!RFunctionDefinition.is(node)) {
			continue;
		}
		if(isGenericDispatcherOnlyBody(node.body)) {
			for(const param of node.parameters) {
				paramIds.add(param.name.info.id);
			}
		}
	}
	return paramIds;
}

/**
 * A definition is treated as used (and hence not reported) if it is the dots parameter, a package lifecycle hook,
 * an S3 method for a dispatched generic, or - when {@link UnusedDefinitionConfig#excludeExportedDefinitions} is set -
 * a package export.
 */
function isConsideredUsed(lexeme: string | undefined, config: UnusedDefinitionConfig, pkg: PackageInfo, called: ReadonlySet<string>): boolean {
	if(lexeme === undefined) {
		return false;
	}
	// non-syntactic definition names (e.g. S3 methods like `"[.irts"`) carry their R quotes or backticks in the lexeme
	const unquoted = removeRQuotes(lexeme);
	const name = unquoted.length > 1 && unquoted.startsWith('`') && unquoted.endsWith('`') ? unquoted.slice(1, -1) : unquoted;
	// the dots are a special parameter and must never be reported
	if(name === DotsParameter) {
		return true;
	}
	// package lifecycle hooks are called by R's package machinery
	if(PackageHookFunctions.has(name)) {
		return true;
	}
	// every dot may be the one splitting method from class, as the generic may carry dots itself (`as.character.foo`)
	for(let dot = name.indexOf('.'); dot > 0; dot = name.indexOf('.', dot + 1)) {
		const generic = name.slice(0, dot);
		if(isKnownS3Generic(generic) || pkg.s3Generics.has(generic) || isDispatched(generic, called)) {
			return true;
		}
	}
	if(config.excludeExportedDefinitions && pkg.exported.has(name)) {
		return true;
	}
	return false;
}

export interface UnusedDefinitionMetadata extends MergeableRecord {
	totalConsidered: number
}

const InterestingEdgesVariable = EdgeType.Reads | EdgeType.Calls | EdgeType.DefinesOnCall;
const InterestingEdgesFunction = EdgeType.Reads | EdgeType.Calls;// include read as this could print the function definition
const InterestingEdgesTargets = EdgeType.SideEffectOnCall;

function getDefinitionArguments(def: NodeId, dfg: DataflowGraph) {
	return dfg.outgoingEdges(def)?.entries().filter(([,e]) => DfEdge.includesType(e, EdgeType.DefinedBy))
		.map(([target]) => target).toArray() ?? [];
}

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
	called: ReadonlySet<string>
): boolean {
	let inParameter = false;
	for(let up = node.info.parent; up !== undefined;) {
		const parent: RNode<ParentInformation> | undefined = ast.idMap.get(up);
		if(parent === undefined) {
			return false;
		}
		inParameter ||= RParameter.is(parent);
		if(RFunctionDefinition.is(parent)) {
			/* the name the definition is bound under is what reaches it, so that is what the contract goes by */
			const bound = parent.info.parent !== undefined ? ast.idMap.get(parent.info.parent) : undefined;
			const name = RBinaryOp.is(bound) ? bound.lhs.lexeme
				: RFunctionCall.is(bound) && bound.arguments[0] !== EmptyArgument ? bound.arguments[0]?.lexeme : undefined;
			return inParameter && name !== undefined && isConsideredUsed(name, config, pkg, called);
		}
		up = parent.info.parent;
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
	if(!FunctionCallVertex.is(df.graph.getVertex(id))) {
		return false;
	}
	const worthKeeping = id === binds ? ImpureProps & ~CallProp.Scope : ImpureProps;
	return ((callFnProps(id, df)?.props ?? 0) & worthKeeping) !== 0;
}

function buildQuickFix(variable: RNode<ParentInformation>, df: Pick<DataflowInformation, 'graph' | 'environment'>, ast: NormalizedAst): LintQuickFixRemove[] | undefined {
	const dfg = df.graph;
	// first we check whether any of the 'Defined by' targets have any obligations - if so, we can not remove the definition
	// otherwise we can automatically remove the full definition!

	if(variable.info.role === RoleInParent.Accessed || variable.info.role === RoleInParent.ForVariable) {
		// this is an access or a for variable, we can not remove it currently
		return undefined;
	}
	const definedBys = getDefinitionArguments(variable.info.id, dfg);

	const hasImportantArgs = definedBys.some(d => dfg.unknownSideEffects.has(d) || doesMoreThanCompute(d, df, variable.info.parent))
		|| definedBys.flatMap(e => Array.from(dfg.outgoingEdges(e) ?? NoEdges))
			.some(([target, e]) => {
				return DfEdge.includesType(e, InterestingEdgesTargets) || dfg.unknownSideEffects.has(target);
			});

	if(hasImportantArgs) {
		return undefined; // we can not remove this definition, it has important arguments
	}

	const totalRangeToRemove = SourceLocation.merge(
		[...definedBys.map(d => {
			const vertex = ast.idMap.get(d);
			return vertex ? SourceLocation.fromNode(vertex) : undefined;
		}),
		variable.info.fullRange ?? variable.location]
	);

	if(totalRangeToRemove === undefined) {
		/* a fix that names no place cannot be carried out, so none is offered */
		return undefined;
	}
	return [{
		type:        'remove',
		loc:         totalRangeToRemove,
		description: `Remove unused definition of \`${variable.lexeme}\``
	}];
}

/**
 * consider `x <- function() ...` if we say `x` is unused and propose to remove everything, there should be no separate quick fix for the function definition
 */
function onlyKeepSupersetOfUnused(
	elements: UnusedDefinitionResult[]
): UnusedDefinitionResult[] {
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
	let parentId = node.info.parent;
	while(parentId !== undefined) {
		const parent = idMap.get(parentId);
		if(parent === undefined) {
			return false;
		}
		if(RParameter.is(parent) && parent.defaultValue?.info.id === child.info.id) {
			return true;
		}
		if(RFunctionCall.isNamed(parent) && Identifier.getName(parent.functionName.content) === 'delayedAssign') {
			return true;
		}
		child = parent;
		parentId = parent.info.parent;
	}
	return false;
}

export const UNUSED_DEFINITION = {
	/* this can be done better once we have types */
	createSearch: config => Q.all().filter(
		config.includeFunctionDefinitions ? F.or(VertexType.VariableDefinition, VertexType.FunctionDefinition) : VertexType.VariableDefinition),
	processSearchResult: async(elements, config, data): Promise<{ results: UnusedDefinitionResult[], '.meta': UnusedDefinitionMetadata }> => {
		const normalize = await data.normalize();
		const dataflow = await data.dataflow();
		const packageInfo = collectPackageInfo(data);
		const calledNames = collectCalledNames(dataflow.graph);
		const s3GenericParams = collectS3GenericParameterIds(normalize);
		const metadata: UnusedDefinitionMetadata = {
			totalConsidered: 0
		};
		return {
			results: onlyKeepSupersetOfUnused(elements.getElements().flatMap(element => {
				metadata.totalConsidered++;
				if(isWithinPromise(element.node, normalize.idMap)) {
					return [];
				}

				const dfgVertex = dataflow.graph.getVertex(element.node.info.id);
				if(!dfgVertex || (
					!VariableDefinitionVertex.is(dfgVertex)
					&& FunctionDefinitionVertex.is(dfgVertex) && !config.includeFunctionDefinitions
				)) {
					return undefined;
				}

				if(s3GenericParams.has(element.node.info.id)) {
					return undefined;
				}

				// an anonymous dispatcher passed to setGeneric()/new_generic() runs on every dispatch, so it is used
				if(FunctionDefinitionVertex.is(dfgVertex) && RFunctionDefinition.is(element.node) && isGenericDispatcherOnlyBody(element.node.body)) {
					return undefined;
				}

				if(isConsideredUsed(element.node.lexeme, config, packageInfo, calledNames)) {
					return undefined;
				}

				/* what calls a hook or dispatches to a method decides its parameters, so they are no more the
				   author's to drop than the name is: `print.foo` keeps the `x` the generic hands it */
				if(hasContractedSignature(element.node, normalize, config, packageInfo, calledNames)) {
					return undefined;
				}

				const ingoingEdges = dataflow.graph.ingoingEdges(dfgVertex.id);

				const interestedIn = VariableDefinitionVertex.is(dfgVertex) ? InterestingEdgesVariable : InterestingEdgesFunction;
				const ingoingInteresting = ingoingEdges?.values().some(e => DfEdge.includesType(e, interestedIn));

				if(ingoingInteresting) {
					return undefined;
				}

				// found an unused definition
				const variableName = element.node.lexeme;
				return [{
					certainty:  LintingResultCertainty.Uncertain,
					variableName,
					involvedId: element.node.info.id,
					loc:        SourceLocation.fromNode(element.node) ?? SourceLocation.invalid(),
					quickFix:   buildQuickFix(element.node, dataflow, normalize)
				}] satisfies UnusedDefinitionResult[];
			}).filter(isNotUndefined)),
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
		defaultConfig: {
			includeFunctionDefinitions: true,
			excludeExportedDefinitions: true
		}
	}
} as const satisfies LintingRule<UnusedDefinitionResult, UnusedDefinitionMetadata, UnusedDefinitionConfig>;
