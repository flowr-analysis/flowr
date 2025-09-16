import type { FileAdapter } from '../adapter-format';
import fs from 'fs';

export const RAdapter = {
	readFile: (p: string) => {
		return {
			'type': '.R',
			'code': fs.readFileSync(p, 'utf8')
		};
	}
} as FileAdapter;
