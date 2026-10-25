/** R console transcripts: `> ` input lines, `+ ` continuations, and recorded output in between */

export interface SessionSegment {
	readonly kind:      'input' | 'output'
	readonly lines:     readonly string[]
	/** 1-based line of the first line */
	readonly firstLine: number
}

const SessionName = /\.(rout|rsession|rconsole)$/i;
const Prompt = /^[>+](?: |$)/;
const Command = /^>(?: |$)/;
const Continuation = /^\+(?: |$)/;
const LineBreak = /\r\n|\r|\n/;

/** the width of `> ` and `+ `, which the code of a line starts behind */
export const PromptWidth = 2;

/** whether a file is a console transcript, by its name or by its first non-blank line starting with a prompt */
export function isRSession(name: string, text: string): boolean {
	return SessionName.test(name) || (text.split(LineBreak).find(line => line.trim() !== '') ?? '').startsWith('> ');
}

/** the transcript as runs of input (a command with its continuations) and output; blank lines are output */
export function parseRSession(text: string): SessionSegment[] {
	const segments: { kind: 'input' | 'output', lines: string[], firstLine: number }[] = [];
	for(const [at, line] of text.split(LineBreak).entries()) {
		const last = segments.at(-1);
		if(Continuation.test(line) && last?.kind === 'input') {
			last.lines.push(line);
		} else if(Command.test(line)) {
			segments.push({ kind: 'input', lines: [line], firstLine: at + 1 });
		} else if(last?.kind === 'output') {
			last.lines.push(line);
		} else {
			segments.push({ kind: 'output', lines: [line], firstLine: at + 1 });
		}
	}
	return segments;
}

/** the code of an input line, behind its prompt */
export const codeOfInput = (line: string): string => Prompt.test(line) ? line.slice(PromptWidth) : line;

/** the script flowR reads: prompts blanked to the same width, output as comments, every line where it was */
export function sessionAsScript(text: string): string {
	return parseRSession(text).flatMap(({ kind, lines }) => kind === 'input'
		? lines.map(line => ' '.repeat(Math.min(PromptWidth, line.length)) + codeOfInput(line))
		: lines.map(line => line.trim() === '' ? line : `# ${line}`)
	).join('\n');
}

/** a command (or several lines of code) with the output a notebook or transcript recorded for it */
export interface RecordedRun {
	/** 1-based line the code starts at in the file, if the format has lines */
	readonly line?:  number
	readonly code:   string
	readonly output: string
}

/** the commands of a transcript with the output recorded below each */
export function recordedRuns(text: string): RecordedRun[] {
	const segments = parseRSession(text);
	return segments.flatMap((s, at) => s.kind === 'input' ? [{
		line:   s.firstLine,
		code:   s.lines.map(codeOfInput).join('\n'),
		output: segments[at + 1]?.kind === 'output' ? segments[at + 1].lines.join('\n').trim() : ''
	}] : []);
}
