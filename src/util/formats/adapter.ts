import type { RParseRequest } from '../../r-bridge/retriever';
import type { FileAdapter, SupportedFormats } from './adapter-format';
import { RAdapter } from './adapters/r-adapter';
import path from 'path';
import { RmdAdapter } from './adapters/rmd-adapter';

export const FileAdapters = {
	'R':   RAdapter,
	'Rmd': RmdAdapter
} as const satisfies Record<SupportedFormats, FileAdapter>;

export type AdapterReturnTypes = ReturnType<typeof FileAdapters[keyof typeof FileAdapters]['convertRequest']>;

export function convertRequestWithAdapter(request: RParseRequest): AdapterReturnTypes {
	const type = inferFileType(request);
	return FileAdapters[type].convertRequest(request);
}

function inferFileType(request: RParseRequest): keyof typeof FileAdapters {
	if(request.request === 'text') {
		// For now we don't know what type the request is 
		// and have to assume it is normal R Code
		// In the future we could add a heuristic to guess the type
		return 'R';
	}

	switch(path.extname(request.content).toLowerCase()) {
		case '.r':   return 'R';
		case '.rmd': return 'Rmd';
		default:     return 'R';
	}
} 
