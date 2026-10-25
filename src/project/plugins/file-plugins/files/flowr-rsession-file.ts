import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FileRole, FlowrFile } from '../../../context/flowr-file';
import { type RecordedRun, recordedRuns, sessionAsScript } from './r-session';

/**
 * This decorates a text file and reads it as a transcript of an R console (`.Rout`, `.Rout.save`):
 * the code is the commands behind their prompts, and everything else is kept as a comment, so every line stays where it was.
 */
export class FlowrRSessionFile extends FlowrFile {
	/**
	 * Prefer the static {@link FlowrRSessionFile.from} method
	 * @param wrapped - the file to load as a transcript
	 */
	constructor(private readonly wrapped: FlowrFileProvider<string>) {
		super(wrapped.path(), wrapped.roles ? [...wrapped.roles, FileRole.Source] : [FileRole.Source]);
	}

	/** The text of the transcript itself, as its content is only the code it holds. */
	public rawText(): string {
		return this.wrapped.content().toString();
	}

	/** The commands with the output the transcript recorded for each. */
	public recorded(): RecordedRun[] {
		return recordedRuns(this.rawText());
	}

	protected loadContent(): string {
		return sessionAsScript(this.rawText());
	}

	/**
	 * Lifts a file to a {@link FlowrRSessionFile}, reusing it if already one and assigning roles.
	 * @param file - The file to lift or return if already a transcript
	 * @param role - An optional role to assign to the file
	 */
	public static from(file: FlowrFileProvider<string> | FlowrRSessionFile, role?: FileRole): FlowrRSessionFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRSessionFile ? file : new FlowrRSessionFile(file);
	}
}
