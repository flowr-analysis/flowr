import type { DataflowProcessorInformation } from './processor';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierReference } from './environments/identifier';
import type { IEnvironment, REnvironmentInformation } from './environments/environment';
import { DataflowGraph } from './graph/graph';
import type { GenericDifferenceInformation, WriteableDifferenceReport } from '../util/diff';


/**
 * A control dependency links a vertex to the control flow element which
 * may have an influence on its execution.
 * Within `if(p) a else b`, `a` and `b` have a control dependency on the `if` (which in turn decides based on `p`).
 *
 * @see {@link happensInEveryBranch} - to check whether a list of control dependencies is exhaustive
 */
export interface ControlDependency {
	/** The id of the node that causes the control dependency to be active (e.g., the condition of an if) */
	readonly id:    NodeId,
	/** when does this control dependency trigger (if the condition is true or false)? */
	readonly when?: boolean
}


/**
 * Classifies the type of exit point encountered.
 *
 * @see {@link ExitPoint}
 */
export const enum ExitPointType {
	/** The exit point is the implicit (last executed expression of a function/block) */
	Default = 0,
	/** The exit point is an explicit `return` call (or an alias of it) */
	Return = 1,
	/** The exit point is an explicit `break` call (or an alias of it) */
	Break = 2,
	/** The exit point is an explicit `next` call (or an alias of it) */
	Next = 3
}

/**
 * An exit point describes the position which ends the current control flow structure.
 * This may be as innocent as the last expression or explicit with a `return`/`break`/`next`.
 *
 * @see {@link ExitPointType} - for the different types of exit points
 * @see {@link addNonDefaultExitPoints} - to easily modify lists of exit points
 * @see {@link alwaysExits} - to check whether a list of control dependencies always triggers an exit
 * @see {@link filterOutLoopExitPoints} - to remove loop exit points from a list
 */
export interface ExitPoint {
	/** What kind of exit point is this one? May be used to filter for exit points of specific causes. */
	readonly type:                ExitPointType,
	/** The id of the node which causes the exit point! */
	readonly nodeId:              NodeId,
	/**
	 * Control dependencies which influence if the exit point triggers
	 * (e.g., if the `return` is contained within an `if` statement).
	 *
	 * @see {@link happensInEveryBranch} - to check whether control dependencies are exhaustive
	 */
	readonly controlDependencies: ControlDependency[] | undefined
}

/**
 * Adds all non-default exit points to the existing list.
 */
export function addNonDefaultExitPoints(existing: ExitPoint[], add: readonly ExitPoint[]): void {
	existing.push(...add.filter(({ type }) => type !== ExitPointType.Default));
}

/** The control flow information for the current DataflowInformation. */
export interface DataflowCfgInformation {
	/** The entry node into the subgraph */
	entryPoint: NodeId,
	/** All already identified exit points (active 'return'/'break'/'next'-likes) of the respective structure. */
	exitPoints: readonly ExitPoint[]
}

/**
 * The dataflow information is one of the fundamental structures we have in the dataflow analysis.
 * It is continuously updated during the dataflow analysis
 * and holds its current state for the respective subtree processed.
 * Each processor during the dataflow analysis may use the information from its children
 * to produce a new state of the dataflow information.
 *
 * You may initialize a new dataflow information with {@link initializeCleanDataflowInformation}.
 *
 * @see {@link DataflowCfgInformation} - the control flow aspects
 */
export interface DataflowInformation extends DataflowCfgInformation {
	/**
	 * References that have not been identified as read or write and will be so on higher processors.
	 *
	 * For example, when we analyze the `x` vertex in `x <- 3`, we will first create an unknown reference for `x`
	 * as we have not yet seen the assignment!
	 *
	 * @see {@link IdentifierReference} - a reference on a variable, parameter, function call, ...
	 */
	unknownReferences:  readonly IdentifierReference[]
	/**
	 * References which are read within the current subtree.
	 *
	 * @see {@link IdentifierReference} - a reference on a variable, parameter, function call, ...
	 * */
	in:                 readonly IdentifierReference[]
	/**
	 * References which are written to within the current subtree
	 *
	 * @see {@link IdentifierReference} - a reference on a variable, parameter, function call, ...
	 */
	out:                readonly IdentifierReference[]
	/** Current environments used for name resolution, probably updated on the next expression-list processing */
	environment:        REnvironmentInformation
	/** TODO TSchoeller */
	builtInEnvironment:	IEnvironment,
	/** The current constructed dataflow graph */
	graph:              DataflowGraph
}

/**
 * Initializes an empty {@link DataflowInformation} object with the given entry point and data.
 * This is to be used as a "starting point" when processing leaf nodes during the dataflow extraction.
 *
 * @see {@link DataflowInformation}
 */
export function initializeCleanDataflowInformation<T>(entryPoint: NodeId, data: Pick<DataflowProcessorInformation<T>, 'environment' | 'builtInEnvironment' | 'completeAst'>): DataflowInformation {
	return {
		unknownReferences:  [],
		in:                 [],
		out:                [],
		environment:        data.environment,
		builtInEnvironment: data.builtInEnvironment,
		graph:              new DataflowGraph(data.completeAst.idMap),
		entryPoint,
		exitPoints:         [{ nodeId: entryPoint, type: ExitPointType.Default, controlDependencies: undefined }]
	};
}

/**
 * Checks whether the given control dependencies are exhaustive (i.e. if for every control dependency on a boolean,
 * the list contains a dependency on the `true` and on the `false` case).
 */
export function happensInEveryBranch(controlDependencies: readonly ControlDependency[] | undefined): boolean {
	if(controlDependencies === undefined) {
		/* the cds are unconstrained */
		return true;
	} else if(controlDependencies.length === 0) {
		/* this happens only when we have no idea and require more analysis */
		return false;
	}

	const trues = [];
	const falseSet = new Set();

	for(const { id, when } of controlDependencies) {
		if(when) {
			trues.push(id);
		} else {
			falseSet.add(id);
		}
	}

	return trues.every(id => falseSet.has(id));
}

/**
 * Checks whether the given dataflow information always exits (i.e., if there is a non-default exit point in every branch).
 * @see {@link ExitPoint} - for the different types of exit points
 */
export function alwaysExits(data: DataflowInformation): boolean {
	return data.exitPoints?.some(
		e => e.type !== ExitPointType.Default && happensInEveryBranch(e.controlDependencies)
	) ?? false;
}

/**
 * Filters out exit points which end their cascade within a loop.
 */
export function filterOutLoopExitPoints(exitPoints: readonly ExitPoint[]): readonly ExitPoint[] {
	return exitPoints.filter(({ type }) => type === ExitPointType.Return || type === ExitPointType.Default);
}

export function diffControlDependency<Report extends WriteableDifferenceReport>(a: ControlDependency | undefined, b: ControlDependency | undefined, info: GenericDifferenceInformation<Report>): void {
	if(a === undefined || b === undefined) {
		if(a !== b) {
			info.report.addComment(`${info.position}Different control dependencies. ${info.leftname}: ${JSON.stringify(a)} vs. ${info.rightname}: ${JSON.stringify(b)}`);
		}
		return;
	}
	if(a.id !== b.id) {
		info.report.addComment(`${info.position}Different control dependency ids. ${info.leftname}: ${a.id} vs. ${info.rightname}: ${b.id}`);
	}
	if(a.when !== b.when) {
		info.report.addComment(`${info.position}Different control dependency when. ${info.leftname}: ${a.when} vs. ${info.rightname}: ${b.when}`);
	}
}

export function diffControlDependencies<Report extends WriteableDifferenceReport>(a: ControlDependency[] | undefined, b: ControlDependency[] | undefined, info: GenericDifferenceInformation<Report>): void {
	if(a === undefined || b === undefined) {
		if(a !== b) {
			info.report.addComment(`${info.position}Different control dependencies: ${JSON.stringify(a)} vs. ${JSON.stringify(b)}`);
		}
		return;
	}
	if(a.length !== b.length) {
		info.report.addComment(`${info.position}Different control dependency lengths: ${a.length} vs. ${b.length}`);
	}
	for(let i = 0; i < a.length; ++i) {
		diffControlDependency(a[i], b[i], { ...info, position: `${info.position}Control dependency at index: ${i}: ` });
	}
}
