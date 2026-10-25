import type { ICodeCell, INotebookContent, IOutput } from '@jupyterlab/nbformat';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FileRole, FlowrFile } from '../../../context/flowr-file';
import type { RecordedRun } from './r-session';

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


	/** The text of the document itself, as its content is only the code it holds. */
	public rawText(): string {
		return this.wrapped.content().toString();
	}

	/** The code cells with the output the notebook recorded for each. */
	public recorded(): RecordedRun[] {
		return (JSON.parse(this.rawText()) as INotebookContent).cells.flatMap(cell => cell.cell_type === 'code'
			? [{ code: joined(cell.source), output: outputText((cell as ICodeCell).outputs).trim() }] : []);
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

const joined = (text: string | readonly string[]) => typeof text === 'string' ? text : text.join('');

/** what a cell printed: streams and the plain text of results, and the error a run ended in */
function outputText(outputs: readonly IOutput[]): string {
	return outputs.map(o => {
		switch(o.output_type) {
			case 'stream': return joined(o.text as string | string[]);
			case 'error': return `Error: ${o.evalue as string}`;
			default: return joined(((o.data as Record<string, string | string[]> | undefined)?.['text/plain']) ?? '');
		}
	}).join('\n');
}

function loadJupyter(content: string): string {
	return (JSON.parse(content) as INotebookContent).cells.map(cell => {
		const source = typeof cell.source === 'object' ? cell.source.join('') : cell.source;
		/* every line of a text cell becomes a comment, whether the notebook stores the cell as lines or as one string */
		return cell.cell_type === 'code' ? source : source.replace(/^/gm, '# ');
	}).join('\n');
}
