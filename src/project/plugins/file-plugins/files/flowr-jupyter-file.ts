import type { INotebookContent } from '@jupyterlab/nbformat';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FileRole, FlowrFile } from '../../../context/flowr-file';

/**
 * This decorates a text file and parses its contents as a Jupyter file.
 * Finnaly, it provides access to the single cells, and all cells fused together as one R file.
 */
export class FlowrJupyterFile extends FlowrFile {
	/**
	 * Prefer the static {@link FlowrJupyterFile.from} method
	 * @param wrapped - the file to load as Jupyter
	 */
	constructor(private readonly wrapped: FlowrFileProvider<string>) {
		super(wrapped.path(), wrapped.roles ? [...wrapped.roles, FileRole.Source] : [FileRole.Source]);
	}

	/**
	 * Loads and parses the content of the wrapped file.
	 * @returns RmdInfo
	 */
	protected loadContent(): string {
		return loadJupyter(this.wrapped.content());
	}

	/**
	 * Lifts a file to a {@link FlowrJupyterFile}, reusing it if already one and assigning roles.
	 * @param file - The file to lift or return if already a Jupyter file
	 * @param role - An optional role to assign to the file
	 */
	public static from(file: FlowrFileProvider<string> | FlowrJupyterFile, role?: FileRole): FlowrJupyterFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrJupyterFile ? file : new FlowrJupyterFile(file);
	}
}

function loadJupyter(content: string): string {
	return (JSON.parse(content) as INotebookContent).cells.map(cell => {
		const source = typeof cell.source === 'object' ? cell.source.join('') : cell.source;
		/* every line of a text cell becomes a comment, whether the notebook stores the cell as lines or as one string */
		return cell.cell_type === 'code' ? source : source.replace(/^/gm, '# ');
	}).join('\n');
}
