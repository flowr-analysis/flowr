import type { RParseRequest } from '../../r-bridge/retriever';
import { assertUnreachable } from '../assert';
import type { FileAdapter, FileData } from './adapter-format';
import { RAdapter } from './adapters/r-adapter';
import { RmdAdapter } from './adapters/rmd-adapter';
import path from 'path';

export const FileAdapters = {
	'.R':   RAdapter,
	'.Rmd': RmdAdapter
} as const satisfies Record<string, FileAdapter>;


export function readFileWithAdapter(p: string): FileData {
	const extension = path.extname(p);

	// Use default adpater as fallback
	if(!Object.hasOwn(FileAdapters, extension)) {
		return FileAdapters['.R'].readFile(p);
	}
	
	return FileAdapters[extension as keyof typeof FileAdapters].readFile(p);
}

export function getCodeFromRequestWithAdapter(request: RParseRequest): string {
	if(request.request === 'text') {
		return request.content;
	} else if(request.request === 'file') {
		return readFileWithAdapter(request.content).code;
	}

	assertUnreachable(request);
}

export function isNormalRFile(p: string) {
	return path.extname(p) === '.R';
}