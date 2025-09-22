import type { RParseRequest, RParseRequestFromFile } from '../../r-bridge/retriever';
import type { FileAdapter, SupportedDocumentTypes, SupportedFormats } from './adapter-format';
import { RAdapter } from './adapters/r-adapter';
import path from 'path';
import { RmdAdapter } from './adapters/rmd-adapter';

export const FileAdapters = {
	'R':   RAdapter,
	'Rmd': RmdAdapter
} as const satisfies Record<SupportedFormats, FileAdapter>;

export const DocumentTypeToFormat = {
	'.r':   'R',
	'.rmd': 'Rmd'
} as const satisfies Record<SupportedDocumentTypes, SupportedFormats>;

export type AdapterReturnTypes = ReturnType<typeof FileAdapters[keyof typeof FileAdapters]['convertRequest']>;

export function requestFromFile(path: string): AdapterReturnTypes {
	const baseRequest = {
		request: 'file',
		content: path
	} satisfies RParseRequestFromFile;
	
	
	const type = inferFileType(baseRequest);
	return FileAdapters[type].convertRequest(baseRequest);
}

export function inferFileType(request: RParseRequest): keyof typeof FileAdapters {
	if(request.request === 'text') {
		// For now we don't know what type the request is 
		// and have to assume it is normal R Code
		// In the future we could add a heuristic to guess the type
		return 'R';
	}

	const type = path.extname(request.content).toLowerCase();

	// Fallback to default if unknown
	if(!Object.hasOwn(DocumentTypeToFormat, type)) {
		return 'R';
	}

	return DocumentTypeToFormat[type as keyof typeof DocumentTypeToFormat];
} 
