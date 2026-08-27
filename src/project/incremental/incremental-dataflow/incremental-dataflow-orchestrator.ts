import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { DataflowGraph } from '../../../dataflow/graph/graph';
import { DataflowInformation } from '../../../dataflow/info';
import type { DataflowProcessorInformation } from '../../../dataflow/processor';
import { standaloneSourceFile } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import type { IEnvironment, REnvironmentInformation } from '../../../dataflow/environments/environment';
import { hashAst, IncrementalUpdateType, type IncrementalUpdateResult } from './incremental-dataflow-update-type-detector';

export type DataflowProcessorInformationBase<OtherInfo> = Omit<DataflowProcessorInformation<OtherInfo>, 'environment' | 'referenceChain' | 'cds'>;

export class IncrementalDataflowOrchestrator {
	private readonly oldAst:     NormalizedAst;
	private readonly newAst:     NormalizedAst;
	private readonly ctx:        FlowrAnalyzerContext;
	private readonly dfDataBase: DataflowProcessorInformationBase<ParentInformation>;

	public constructor(
		oldAst:     NormalizedAst,
		newAst:     NormalizedAst,
		ctx:        FlowrAnalyzerContext,
		dfDataBase: DataflowProcessorInformationBase<ParentInformation>
	) {
		this.oldAst = oldAst;
		this.newAst = newAst;
		this.ctx = ctx;
		this.dfDataBase = dfDataBase;
	}

	public tryIncrementalUpdate(update: IncrementalUpdateResult): DataflowInformation | undefined {
		switch(update.types[0]) {
			case IncrementalUpdateType.NewFileAtEnd:
				return update.filePath === undefined ? undefined : this.handleNewFileAtEnd(update.filePath);
			case IncrementalUpdateType.Comment:
			case IncrementalUpdateType.Location:
			case IncrementalUpdateType.Nothing:
				return this.reusePersisted();
			case IncrementalUpdateType.Full:
			case IncrementalUpdateType.AddedAtEnd:
			case IncrementalUpdateType.RemovedAtEnd:
			case IncrementalUpdateType.RemovedFileAtEnd:
				return undefined;
			default:
				return undefined;
		}
	}

	private handleNewFileAtEnd(filePath: string): DataflowInformation | undefined {
		const indexOfNewFile = this.newAst.ast.files.length - 1;
		const newFile = this.newAst.ast.files[indexOfNewFile];
		const firstFile = this.newAst.ast.files[0];

		if(newFile === undefined || firstFile === undefined || newFile.filePath !== filePath) {
			return undefined;
		}

		const revived = this.reviveOldDataflowGraph();
		if(!revived) {
			return undefined;
		}

		const information: DataflowInformation = {
			...DataflowInformation.initialize(firstFile.root.info.id, { environment: revived.environment, completeAst: this.newAst }),
			graph: revived.graph
		};

		return standaloneSourceFile(indexOfNewFile, newFile, {
			...this.dfDataBase,
			completeAst:    this.newAst,
			environment:    revived.environment,
			referenceChain: [firstFile.filePath],
			cds:            undefined
		}, information);
	}

	private reusePersisted(): DataflowInformation | undefined {
		const revived = this.reviveOldDataflowGraph();
		if(!revived) {
			return undefined;
		}
		const firstFile = this.newAst.ast.files[0];
		if(firstFile === undefined) {
			return undefined;
		}
		return {
			...DataflowInformation.initialize(firstFile.root.info.id, { environment: revived.environment, completeAst: this.newAst }),
			graph: revived.graph
		};
	}

	private reviveOldDataflowGraph(): { graph: DataflowGraph, environment: REnvironmentInformation } | undefined {
		const oldRoot = this.oldAst.ast.files[0];
		if(oldRoot === undefined) {
			return undefined;
		}
		const oldHash = hashAst(this.oldAst.ast);
		const entry = this.ctx.inc.getPersistedDataflowGraphOf(oldRoot.root.info.id, oldHash);
		if(!entry) {
			return undefined;
		}
		const builtInEnv = this.ctx.env.builtInEnvironment as IEnvironment;
		const emptyBuiltInEnv = this.ctx.env.emptyBuiltInEnvironment as IEnvironment;
		return {
			graph:       DataflowGraph.fromPersisted(entry.graph, builtInEnv, emptyBuiltInEnv),
			environment: DataflowGraph.reviveEnvironment(entry.environment, builtInEnv, emptyBuiltInEnv)
		};
	}
}
