import type { RParseRequest } from '../../r-bridge/retriever';

export interface FileAdapter {
    convertRequest(request: RParseRequest): RParseRequest
}

export type SupportedFormats = 'R' | 'Rmd';

export type SupportedDocumentTypes = '.r' | '.rmd';
