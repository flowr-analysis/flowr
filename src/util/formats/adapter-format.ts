import type { FileAdapters } from './adapter';

export interface FileAdapter<AdditionalInfo = object> {
    readFile(p: string): FileData<AdditionalInfo>
}

export type FileData<AdditionalInfo = object> = FileDataBase & AdditionalInfo;

export interface FileDataBase {
    type: keyof typeof FileAdapters
    code: string
}
