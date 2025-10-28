import type { RParseRequest } from '../../../r-bridge/retriever';
import type { FileAdapter } from '../adapter-format';

export const RAdapter = {
	convertRequest: (request: RParseRequest) => request
} satisfies FileAdapter;
