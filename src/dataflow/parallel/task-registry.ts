import objectHash from "object-hash";
import { RProjectFile } from "../../r-bridge/lang-4.x/ast/model/nodes/r-project"
import { ParentInformation } from "../../r-bridge/lang-4.x/ast/model/processing/decorate"
import { DataflowInformation } from "../info"
import { standaloneSourceFile } from "../internal/process/functions/call/built-in/built-in-source";
import { DataflowProcessorInformation } from "../processor"


export interface SourceFilePayload<OtherInfo>{
    index: number;
    file: RProjectFile<OtherInfo & ParentInformation>;
    data: DataflowProcessorInformation<OtherInfo & ParentInformation>;
    dataflowInfo: DataflowInformation;
}



export const workerTasks = {
    parallelFiles: async <OtherInfo>(paylaod: SourceFilePayload<OtherInfo>)
    : Promise<DataflowInformation> => {
        return standaloneSourceFile<OtherInfo>(
            paylaod.index, paylaod.file, 
            paylaod.data, paylaod.dataflowInfo
        );
    },
    testPool: async <OtherInfo>(payload: SourceFilePayload<OtherInfo>)
    : Promise<void> => {
        console.log(`Processing ${payload.file.filePath} @ index ${payload.index}`);
    }
}

export type TaskRegistry = typeof workerTasks;
export type TaskName = keyof TaskRegistry;