import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { DataflowGraph } from '../../../dataflow/graph/graph';
import { ExitPointType, type DataflowInformation, type ExitPoint } from '../../../dataflow/info';
import type { DataflowProcessorInformation } from '../../../dataflow/processor';
import { standaloneSourceFile } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { processExpressionList } from '../../../dataflow/internal/process/functions/call/built-in/built-in-expression-list';
import { wrapArgumentsUnnamed } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import { overwriteEnvironment } from '../../../dataflow/environments/overwrite';
import { ControlFlow } from '../../../dataflow/internal/control-flow';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { SourceRange } from '../../../util/range';
import type { IEnvironment, REnvironmentInformation } from '../../../dataflow/environments/environment';
import type { IdentifierReference } from '../../../dataflow/environments/identifier';
import type { HookInformation } from '../../../dataflow/hooks';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { hashAst, IncrementalUpdateType, type IncrementalUpdateResult } from './incremental-dataflow-update-type-detector';

export type DataflowProcessorInformationBase<OtherInfo> = Omit<DataflowProcessorInformation<OtherInfo>, 'environment' | 'referenceChain' | 'cds'>;

interface RevivedDataflowGraph {
	readonly graph:             DataflowGraph;
	readonly environment:       REnvironmentInformation;
	readonly entryPoint:        NodeId;
	readonly cfgEntry?:         NodeId;
	readonly exitPoints:        readonly ExitPoint[];
	readonly in:                readonly IdentifierReference[];
	readonly out:               readonly IdentifierReference[];
	readonly unknownReferences: readonly IdentifierReference[];
	readonly hooks:             readonly HookInformation[];
}

/**
 * Tries to patch the dataflow graph incrementally for the classification from {@link determineUpdateTypes}.
 * Returns `undefined` whenever it cannot (safely) do so, leading to a full recompute.
 */
export function tryIncrementalUpdate(
	oldAst:     NormalizedAst,
	newAst:     NormalizedAst,
	ctx:        FlowrAnalyzerContext,
	dfDataBase: DataflowProcessorInformationBase<ParentInformation>,
	update:     IncrementalUpdateResult
): DataflowInformation | undefined {

	function reviveOldDataflowGraph(): RevivedDataflowGraph | undefined {
		const oldRoot = oldAst.ast.files[0];
		if(oldRoot === undefined) {
			return undefined;
		}
		const oldHash = hashAst(oldAst.ast);
		const entry = ctx.inc.getPersistedDataflowGraphOf(oldRoot.root.info.id, oldHash);
		if(!entry) {
			return undefined;
		}
		const builtInEnv = ctx.env.builtInEnvironment as IEnvironment;
		const emptyBuiltInEnv = ctx.env.emptyBuiltInEnvironment as IEnvironment;
		try {
			const graph = DataflowGraph.fromPersisted(entry.graph, builtInEnv, emptyBuiltInEnv);
			graph.setIdMap(newAst.idMap);
			return {
				graph,
				environment:       DataflowGraph.reviveEnvironment(entry.environment, builtInEnv, emptyBuiltInEnv),
				entryPoint:        entry.entryPoint,
				cfgEntry:          entry.cfgEntry,
				exitPoints:        entry.exitPoints,
				in:                entry.in,
				out:               entry.out,
				unknownReferences: entry.unknownReferences,
				hooks:             entry.hooks
			};
		} catch{
			return undefined;
		}
	}

	function handleNewFileAtEnd(filePath: string): DataflowInformation | undefined {
		const indexOfNewFile = newAst.ast.files.length - 1;
		const newFile = newAst.ast.files[indexOfNewFile];
		const firstFile = newAst.ast.files[0];

		if(newFile === undefined || firstFile === undefined || newFile.filePath !== filePath) {
			return undefined;
		}

		const revived = reviveOldDataflowGraph();
		if(!revived) {
			return undefined;
		}

		const information: DataflowInformation = {
			unknownReferences: revived.unknownReferences,
			in:                revived.in,
			out:               revived.out,
			environment:       revived.environment,
			graph:             revived.graph,
			entryPoint:        revived.entryPoint,
			cfgEntry:          revived.cfgEntry,
			exitPoints:        revived.exitPoints,
			hooks:             [...revived.hooks]
		};

		return standaloneSourceFile(indexOfNewFile, newFile, {
			...dfDataBase,
			completeAst:    newAst,
			environment:    revived.environment,
			referenceChain: [firstFile.filePath],
			cds:            undefined
		}, information);
	}

	function handleAddedAtEnd(filePath: string): DataflowInformation | undefined {
		if(oldAst.ast.files.length !== 1 || newAst.ast.files.length !== 1) {
			return undefined;
		}
		const oldFile = oldAst.ast.files[0];
		const newFile = newAst.ast.files[0];
		if(oldFile === undefined || newFile?.filePath !== filePath) {
			return undefined;
		}

		const oldRoot = oldFile.root;
		const newRoot = newFile.root;
		const newChildren = newRoot.children.slice(oldRoot.children.length);
		if(newChildren.length === 0) {
			return undefined;
		}

		const revived = reviveOldDataflowGraph();
		if(!revived) {
			return undefined;
		}

		const symbol = {
			type:     RType.Symbol,
			info:     newRoot.info,
			content:  '{',
			lexeme:   '{',
			location: newRoot.location ?? SourceRange.invalid(),
			ns:       'base'
		} as const;

		const tail = processExpressionList(symbol, wrapArgumentsUnnamed(newChildren, newAst.idMap), newRoot.info.id, {
			...dfDataBase,
			completeAst:    newAst,
			environment:    revived.environment,
			referenceChain: [filePath],
			cds:            undefined
		});

		const graph = revived.graph.mergeWith(tail.graph);
		const environment = overwriteEnvironment(revived.environment, tail.environment);

		ControlFlow.continuesWith(graph, { entryPoint: revived.entryPoint, cfgEntry: revived.cfgEntry, cfgExit: undefined, exitPoints: revived.exitPoints, hooks: [] }, ControlFlow.entryOf(tail));

		return {
			unknownReferences: [...revived.unknownReferences, ...tail.unknownReferences],
			in:                [...revived.in, ...tail.in],
			out:               [...revived.out, ...tail.out],
			environment,
			graph,
			/* appending never changes which statement is first */
			entryPoint:        revived.entryPoint,
			cfgEntry:          revived.cfgEntry,
			cfgExit:           undefined,
			exitPoints:        tail.exitPoints,
			hooks:             [...revived.hooks, ...tail.hooks]
		};
	}

	function handleRemovedAtEnd(filePath: string): DataflowInformation | undefined {
		if(oldAst.ast.files.length !== 1 || newAst.ast.files.length !== 1) {
			return undefined;
		}
		const oldFile = oldAst.ast.files[0];
		const newFile = newAst.ast.files[0];
		if(oldFile === undefined || newFile?.filePath !== filePath) {
			return undefined;
		}

		const oldRoot = oldFile.root;
		const newRoot = newFile.root;
		const removedChildren = oldRoot.children.slice(newRoot.children.length);
		if(removedChildren.length === 0) {
			return undefined;
		}

		const revived = reviveOldDataflowGraph();
		if(!revived) {
			return undefined;
		}

		const removedIds = RNode.collectAllIds(removedChildren);
		for(const id of removedIds) {
			const argId = `${id}-arg` as NodeId;
			if(revived.graph.hasVertex(argId)) {
				removedIds.add(argId);
			}
		}

		if(revived.out.some(ref => removedIds.has(ref.nodeId))) {
			return undefined;
		}

		// find new entrypoint
		const boundarySources = new Set<NodeId>();
		for(const [source, targets] of revived.graph.edges()) {
			if(removedIds.has(source)) {
				continue;
			}
			for(const [target, edge] of targets) {
				if(removedIds.has(target) && DfEdge.includesType(edge, EdgeType.FlowEdge)) {
					boundarySources.add(source);
				}
			}
		}
		if(boundarySources.size !== 1) {
			return undefined;
		}
		const [newExitId] = boundarySources;

		revived.graph.removeVertices(removedIds);

		return {
			unknownReferences: revived.unknownReferences.filter(ref => !removedIds.has(ref.nodeId)),
			in:                revived.in.filter(ref => !removedIds.has(ref.nodeId)),
			out:               revived.out.filter(ref => !removedIds.has(ref.nodeId)),
			environment:       revived.environment,
			graph:             revived.graph,
			entryPoint:        revived.entryPoint,
			cfgEntry:          revived.cfgEntry,
			cfgExit:           undefined,
			exitPoints:        [{ type: ExitPointType.Default, nodeId: newExitId }],
			hooks:             [...revived.hooks].filter(hook => !removedIds.has(hook.id))
		};
	}

	function reusePersisted(): DataflowInformation | undefined {
		const revived = reviveOldDataflowGraph();
		if(!revived) {
			return undefined;
		}
		return {
			unknownReferences: revived.unknownReferences,
			in:                revived.in,
			out:               revived.out,
			environment:       revived.environment,
			graph:             revived.graph,
			entryPoint:        revived.entryPoint,
			cfgEntry:          revived.cfgEntry,
			exitPoints:        revived.exitPoints,
			hooks:             [...revived.hooks]
		};
	}

	const cannotPatch = () => undefined;

	const handlerByType: Record<IncrementalUpdateType, (filePath: string | undefined) => DataflowInformation | undefined> = {
		[IncrementalUpdateType.NewFileAtEnd]:     filePath => filePath === undefined ? undefined : handleNewFileAtEnd(filePath),
		[IncrementalUpdateType.AddedAtEnd]:       filePath => filePath === undefined ? undefined : handleAddedAtEnd(filePath),
		[IncrementalUpdateType.RemovedAtEnd]:     filePath => filePath === undefined ? undefined : handleRemovedAtEnd(filePath),
		[IncrementalUpdateType.Comment]:          reusePersisted,
		[IncrementalUpdateType.Location]:         reusePersisted,
		[IncrementalUpdateType.Nothing]:          reusePersisted,
		[IncrementalUpdateType.Full]:             cannotPatch,
		[IncrementalUpdateType.RemovedFileAtEnd]: cannotPatch
	};

	const handlers = new Set(update.types.map(type => handlerByType[type]));
	if(handlers.size !== 1) {
		return undefined;
	}
	const [handler] = handlers;
	return handler(update.filePath);
}