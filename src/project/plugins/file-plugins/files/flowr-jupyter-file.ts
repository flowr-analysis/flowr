import type { INotebookContent } from '@jupyterlab/nbformat';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FileRole, FlowrFile } from '../../../context/flowr-file';


/**
 * This decorates a text file and parses its contents as a Jupyter file.
 * Finnaly, it provides access to the single cells, and all cells fused together as one R file.
 */
export class FlowrJupyterFile extends FlowrFile<string> {
	private readonly wrapped: FlowrFileProvider<string>;

	/**
	 * Prefer the static {@link FlowrRMarkdownFile.from} method
	 * @param file - the file to load as R Markdown
	 */
	constructor(file: FlowrFileProvider<string>) {
		super(file.path(), file.roles ? [...file.roles, FileRole.Source] : [FileRole.Source]);
		this.wrapped = file;
	}

	/**
	 * Loads and parses the content of the wrapped file.
	 * @returns RmdInfo
	 */
	protected loadContent(): string {
		return loadJupyter(this.wrapped.content());
	}

	public static from(file: FlowrFileProvider<string> | FlowrJupyterFile): FlowrJupyterFile {
		return file instanceof FlowrJupyterFile ? file : new FlowrJupyterFile(file);
	}
}

function loadJupyter(content: string): string {
	const nb = JSON.parse(content) as INotebookContent;

	return nb.cells.map(cell => {
		if(cell.cell_type === 'code') {
			return typeof cell.source === 'object' ? cell.source.join('') : cell.source;
		} else {
			return typeof cell.source === 'object' ? cell.source.map(s => `# ${s}`).join('') : `# ${cell.source}`;
		}
	}).join('\n');
}
