import type { RProjectFile } from '../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { KnownParser } from '../../r-bridge/parser';
import { guard } from '../../util/assert';
import type { DataflowInformation } from '../info';
import { standaloneSourceFile } from '../internal/process/functions/call/built-in/built-in-source';
import type { DataflowProcessorInformation } from '../processor';


export interface SourceFilePayload<OtherInfo>{
    index:        number;
    file:         RProjectFile<OtherInfo & ParentInformation>;
    data:         DataflowProcessorInformation<OtherInfo & ParentInformation>; //switch with serializable version
    dataflowInfo: DataflowInformation; // not needed
}

export type TaskType = 'task' | 'subtask' | 'init';

export type RunSubtask = <TInput, TOutput>(
    taskName: TaskName,
    taskPayload: TInput
) => Promise<TOutput>;


let _parserEngine: KnownParser;
/** Cache this as it rarely changes */
let _dataflowProcessorInfo: DataflowProcessorInformation<unknown>;

/**
 *
 */
export function SetParserEngine(engine: KnownParser | undefined){
	guard(engine !== undefined, 'Worker received no parser.');
	_parserEngine = engine;
}

export const workerTasks = {
	parallelFiles: <OtherInfo>(
		payload: SourceFilePayload<OtherInfo>,
		_runSubtask: RunSubtask
	): DataflowInformation => {
		// rebuild data

		const result = standaloneSourceFile<OtherInfo>(
			payload.index, payload.file,
			payload.data, payload.dataflowInfo
		);

		// convert to clonable Dataflow Information
		return result;
	},

	testPool: async <OtherInfo>(
		payload: SourceFilePayload<OtherInfo>,
		runSubtask: RunSubtask
	): Promise<undefined> => {
		//console.log(`Processing ${JSON.stringify(payload.file)} @ index ${payload.index}`);
		const result = await runSubtask<Record<string, never>, number>('otherFunction', {});
		const result2 = await runSubtask<Record<string, never>, number>('otherFunction', {});
		console.log(`Got ${result} and ${result2} as value from subtask`);
		return undefined;
	},

	otherFunction: (): number => {
		console.log('Another function as a subtask');
		return Math.random();
	}
};

export type TaskRegistry = typeof workerTasks;
export type TaskName = keyof TaskRegistry;