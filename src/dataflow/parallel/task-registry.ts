import type { RProjectFile } from '../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { KnownParser } from '../../r-bridge/parser';
import { guard } from '../../util/assert';
import type { SerializableDataflowInformation } from '../info';
import { initializeCleanDataflowInformation, SerializeDataflowInformation } from '../info';
import { standaloneSourceFile } from '../internal/process/functions/call/built-in/built-in-source';
import { DeserializeDataflowProcessorInformation, SerializeDataflowProcessorInformation, type SerializedDataflowProcessorInformation } from '../processor';
import { processors } from '../extractor';
import { dataflowLogger } from '../logger';


export interface DataflowPayload<OtherInfo>{
    index: number;
    file:  RProjectFile<OtherInfo & ParentInformation>;
    data:  SerializedDataflowProcessorInformation<OtherInfo & ParentInformation>; //switch with serializable version
}

export interface DataflowReturnPayload<OtherInfo>{
    processorInfo: SerializedDataflowProcessorInformation<OtherInfo & ParentInformation>;
    dataflowData:  SerializableDataflowInformation;
}

export type TaskType = 'task' | 'subtask' | 'init';

export type RunSubtask = <TInput, TOutput>(
    taskName: TaskName,
    taskPayload: TInput
) => Promise<TOutput>;


let _parserEngine: KnownParser;

/**
 *
 */
export function SetParserEngine(engine: KnownParser | undefined){
	guard(engine !== undefined, 'Worker received no parser.');
	_parserEngine = engine;
}

export const workerTasks = {
	parallelFiles: <OtherInfo>(
		payload: DataflowPayload<OtherInfo>,
		_runSubtask: RunSubtask
	): DataflowReturnPayload<OtherInfo> => {
		// rebuild data
		dataflowLogger.info('Parser Engine: ', _parserEngine);
		const dataflowProcessorInfo = DeserializeDataflowProcessorInformation(payload.data, processors, _parserEngine);

		// create new DataflowInfo
		const dataflow = initializeCleanDataflowInformation(payload.file.root.info.id, dataflowProcessorInfo);

		const result = standaloneSourceFile<OtherInfo>(
			payload.index, payload.file,
			dataflowProcessorInfo, dataflow
		);

		// convert to return payload
		return {
			processorInfo: SerializeDataflowProcessorInformation(dataflowProcessorInfo),
			dataflowData:  SerializeDataflowInformation(result),
		};
	},

	testPool: async <OtherInfo>(
		payload: DataflowPayload<OtherInfo>,
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