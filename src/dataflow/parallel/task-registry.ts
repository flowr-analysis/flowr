import type { RProjectFile } from '../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../info';
import { standaloneSourceFile } from '../internal/process/functions/call/built-in/built-in-source';
import type { DataflowProcessorInformation } from '../processor';


export interface SourceFilePayload<OtherInfo>{
    index:        number;
    file:         RProjectFile<OtherInfo & ParentInformation>;
    data:         DataflowProcessorInformation<OtherInfo & ParentInformation>;
    dataflowInfo: DataflowInformation;
}

export type TaskType = 'task' | 'subtask' | 'init';

// export interface TaskMessage<OtherInfo> {
//     type:     TaskType;
//     id:       number;
//     taskName: TaskName;
//     payload:  SourceFilePayload<OtherInfo>;
// }

export type RunSubtask = <TInput, TOutput>(
    taskName: TaskName,
    taskPayload: TInput
) => Promise<TOutput>;

// export type WorkerTask<TInput, TOutput> = (
//     payload: TInput,
//     runSubtask: RunSubtask
// ) => Promise<TOutput> | TOutput;



export const workerTasks = {
	parallelFiles: <OtherInfo>(
		payload: SourceFilePayload<OtherInfo>,
		_runSubtask: RunSubtask
	): DataflowInformation => {
		return standaloneSourceFile<OtherInfo>(
			payload.index, payload.file,
			payload.data, payload.dataflowInfo
		);
	},

	testPool: async <OtherInfo>(
		payload: SourceFilePayload<OtherInfo>,
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
	}
};

export type TaskRegistry = typeof workerTasks;
export type TaskName = keyof TaskRegistry;