import fs from 'node:fs'
import path from 'path'

/**
 * Require all files in a folder that end with a suffix
 * @param folder - the folder to require all files from
 * @param suffix - the suffix which the files of interest must have
 */
export function requireAllTestsInFolder(folder: string, suffix = '-tests.ts'): void {
	for(const file of fs.readdirSync(folder)) {
		if(file.endsWith(suffix)) {
			require(path.join(folder,file))
		}
	}
}
