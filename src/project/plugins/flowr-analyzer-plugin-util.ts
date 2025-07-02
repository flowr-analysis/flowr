import type { PathLike } from 'fs';
import { getAllFiles } from '../../util/files';

export async function findFileFromRoot(rootPath: PathLike, fileName: string) : Promise<PathLike | undefined> {
	try {
		const files = getAllFiles(rootPath.toString(), new RegExp(`^${fileName}$`));
		const descriptionFilesFound : PathLike[] = [];
		for await (const file of files) {
			descriptionFilesFound.push(file);
		}
		return descriptionFilesFound.length > 0 ? descriptionFilesFound[0] : undefined;
	} catch(error) {
		console.error(`Error reading directory ${rootPath.toString()}:`, error);
	}
	return undefined;
}