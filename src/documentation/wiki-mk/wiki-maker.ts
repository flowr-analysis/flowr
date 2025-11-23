import type { PathLike } from 'fs';

export interface WikiMakerArgs {
	/** Which file this wiki should be created for */
	readonly target: PathLike;
	/** Overwrite existing wiki files, even if nothing changes */
	readonly force?: boolean;
}


export class WikiMaker {

}