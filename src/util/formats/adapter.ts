import type { RParseRequest, RParseRequestFromFile, RParseRequestFromText } from '../../r-bridge/retriever';
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

/**
 *
 */
export function requestFromFile(path: string): AdapterReturnTypes {
	const baseRequest = {
		request: 'file',
		content: path
	} satisfies RParseRequestFromFile;


	const type = inferFileType(baseRequest);
	return FileAdapters[type].convertRequest(baseRequest);
}

/**
 *
 */
export function requestFromText(text: string, typeHint?: SupportedFormats): AdapterReturnTypes {
	const baseRequest = {
		request: 'text',
		content: text,
		info:    typeHint ? { type: typeHint } : undefined
	} satisfies RParseRequestFromText;

	const type = inferFileType(baseRequest);
	return FileAdapters[type].convertRequest(baseRequest);
}

/**
 *
 */
export function inferFileType(request: RParseRequest): keyof typeof FileAdapters {
	if(request.request === 'text') {
		return request.info ? request.info.type : 'R';
	}

	const type = path.extname(request.content).toLowerCase();

	// Fallback to default if unknown
	if(!Object.hasOwn(DocumentTypeToFormat, type)) {
		return 'R';
	}

	return DocumentTypeToFormat[type as keyof typeof DocumentTypeToFormat];
}
