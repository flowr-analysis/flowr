import type { RProjectFile } from '../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { KnownParser } from '../../r-bridge/parser';
import { guard } from '../../util/assert';
import type { SerializableDataflowInformation } from '../info';
import { SerializeDataflowInformation } from '../info';
import { DeserializeDataflowProcessorInformation, processDataflowFor, SerializeDataflowProcessorInformation, type SerializedDataflowProcessorInformation } from '../processor';
import { processors } from '../extractor';
import type { DataflowWorkerTiming } from '../timing';


export interface DataflowPayload<OtherInfo> {
    index: number;
    file:  RProjectFile<OtherInfo & ParentInformation>;
    data:  SerializedDataflowProcessorInformation<OtherInfo & ParentInformation>; //switch with serializable version
}

export interface DataflowReturnPayload<OtherInfo> {
    processorInfo: SerializedDataflowProcessorInformation<OtherInfo & ParentInformation>;
    dataflowData:  SerializableDataflowInformation;
	workerTiming:     DataflowWorkerTiming;
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
export function SetParserEngine(engine: KnownParser | undefined) {
	guard(engine !== undefined, 'Worker received no parser.');
	_parserEngine = engine;
}

export const workerTasks = {
	parallelFiles: <OtherInfo>(
		payload: DataflowPayload<OtherInfo>,
		_runSubtask: RunSubtask
	): DataflowReturnPayload<OtherInfo> => {
		// rebuild data
		// dataflowLogger.info('Parser Engine: ', _parserEngine);
		const deserializeStart = Date.now();
		const dataflowProcessorInfo = DeserializeDataflowProcessorInformation(payload.data, processors, _parserEngine);
		const deserializationMs = Date.now() - deserializeStart;

		// create new DataflowInfo
		//const dataflow = initializeCleanDataflowInformation(payload.file.root.info.id, dataflowProcessorInfo);

		const analysisStart = Date.now();
		const result = processDataflowFor<OtherInfo>(
			payload.file.root, dataflowProcessorInfo
		);
		const analysisMs = Date.now() - analysisStart;

		const serializeStart = Date.now();
		const processorInfo = SerializeDataflowProcessorInformation(dataflowProcessorInfo);
		const dataflowData = SerializeDataflowInformation(result);
		const serializationMs = Date.now() - serializeStart;

		return {
			processorInfo,
			dataflowData,
			workerTiming: {
				deserializationMs,
				analysisMs,
				serializationMs,
			}
		};
	},

	testPool: async <OtherInfo>(
		payload: DataflowPayload<OtherInfo>,
		runSubtask: RunSubtask
	): Promise<undefined> => {
		console.log(`Processing ${JSON.stringify(payload.file)} @ index ${payload.index}`);
		const result = await runSubtask<Record<string, never>, number>('otherFunction', {});
		const result2 = await runSubtask<Record<string, never>, number>('otherFunction', {});
		console.log(`Got ${result} and ${result2} as value from subtask`);
		return undefined;
	},

	otherFunction: (): number => {
		console.log('Another function as a subtask');
		return Math.random();
	},

	__fastTask: (value: number): number => {
		if(process.env.NODE_ENV !== 'test') {
			throw new Error('Internal function __fastTask can only be used in test environment');
		}
		return value; /** mirror value back to caller */
	},

	__slowTask: async(value: number): Promise<number> => {
		if(process.env.NODE_ENV !== 'test') {
			throw new Error('Internal function __slowTask can only be used in test environment');
		}
		await new Promise(r => setTimeout(r, value));
		return value; /** mirror value back to caller */
	},

	__spawnSubtasks: async(count: number, runSubtask: RunSubtask): Promise<void> => {
		if(process.env.NODE_ENV !== 'test') {
			throw new Error('Internal function __spawnSubtasks can only be used in test environment');
		}
		const tasks = [];
		console.log(`Spawning ${count} subtasks`);
		for(let i = 0; i < count; i++) {
			tasks.push(runSubtask('__fastTask', 10));
		}
		await Promise.all(tasks);
		return;
	},

	__crash: () => {
		if(process.env.NODE_ENV !== 'test') {
			throw new Error('Internal function __crash can only be used in test environment');
		}
		throw new Error('Intentional crash from __crash');
	},

	__stall: async() => {
		if(process.env.NODE_ENV !== 'test') {
			throw new Error('Internal function __stall can only be used in test environment');
		}
		await new Promise(() => { }); // never resolves
	}
};

export type TaskRegistry = typeof workerTasks;
export type TaskName = keyof TaskRegistry;