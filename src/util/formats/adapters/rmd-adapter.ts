import type { FileAdapter } from '../adapter-format';


export const RmdAdapter = {
	readFile: (p: string) => {
		return {
			'type': '.rmd',
			'code': 'asd'
		};
	}
} as FileAdapter;
