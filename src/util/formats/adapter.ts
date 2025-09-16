import type { FileAdapter, FileData } from './adapter-format';
import { RAdapter } from './adapters/r-adapter';
import { RmdAdapter } from './adapters/rmd-adapter';
import path from 'path';

export const FileAdapters = {
	'.R':   RAdapter,
	'.Rmd': RmdAdapter
} as const satisfies Record<string, FileAdapter>;


export function readFile(p: string): FileData | undefined {
	const extension = path.extname(p);

	if(!Object.hasOwn(FileAdapters, extension)) {
		return undefined;
	}

	return FileAdapters[extension as keyof typeof FileAdapters].readFile(p);
}

