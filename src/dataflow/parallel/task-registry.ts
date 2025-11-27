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



export const workerTasks = {
	parallelFiles: <OtherInfo>(payload: SourceFilePayload<OtherInfo>): DataflowInformation => {
		return standaloneSourceFile<OtherInfo>(
			payload.index, payload.file,
			payload.data, payload.dataflowInfo
		);
	},
	testPool: <OtherInfo>(payload: SourceFilePayload<OtherInfo>): void => {
		console.log(`Processing ${payload.file.filePath} @ index ${payload.index}`);
	}
};

export type TaskRegistry = typeof workerTasks;
export type TaskName = keyof TaskRegistry;