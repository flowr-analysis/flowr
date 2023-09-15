export type Os = 'mac-os' | 'linux' | 'windows' | 'unknown';

let platformCache: Os | null = null;

export function getPlatform(): Os {
	if(platformCache !== null) {
		return platformCache;
	}

	let OS =  process.platform;
	if(OS === 'darwin') {
		platformCache = 'mac-os';
	}
	else if(OS === 'linux') {
		platformCache = 'linux';
	}
	else if(OS === 'win32') {
		platformCache = 'windows';
	} else {
		platformCache = 'unknown';
	}

	return platformCache;
}
