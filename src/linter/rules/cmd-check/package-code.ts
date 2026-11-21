import type { PackageFiles } from './package-files';

/** Where code outside of the `R/` folder of a package comes from. */
export type CodeOrigin = 'tests' | 'vignettes' | 'examples';

/** A piece of R code of a package that does not live in `R/`, but which `R CMD check` still runs (or reads). */
export interface PackageCode {
	readonly origin:     CodeOrigin
	/** the file the code is taken from, relative to the package root */
	readonly file:       string
	/** the code itself, with the lines that are no R code blanked so that line numbers stay as they are in the file */
	readonly code:       string
	/** for a vignette, the packages its `%\VignetteDepends{}` names and the package of its `%\VignetteEngine{}` */
	readonly depends?:   readonly string[]
	/** the line of {@link file} the first line of {@link code} is on */
	readonly lineOffset: number
}

/** the test frameworks whose folders `R CMD check` looks into, besides `tests/` itself */
const TestSubdirectories = ['testthat', 'testit', 'unitizer', 'RUnit'] as const;

/** the files of the test code, as `tools:::.check_packages_used_in_tests` collects them */
function isTestFile(relative: string): boolean {
	if(!/\.[rR]$/.test(relative) || !relative.startsWith('tests/')) {
		return false;
	}
	const rest = relative.slice('tests/'.length);
	return !rest.includes('/') || TestSubdirectories.some(d => rest.startsWith(`${d}/`) && !rest.slice(d.length + 1).includes('/'));
}

/** keeps the code chunks of an R Markdown or Sweave document, blanking every other line */
export function vignetteChunks(text: string, sweave: boolean): string {
	const lines = text.split(/\r?\n/);
	let inChunk = false;
	return lines.map(line => {
		if(!inChunk && (sweave ? /^\s*<<.*>>=\s*$/.test(line) : /^\s*```+\s*\{\s*r\b[^}]*\}\s*$/i.test(line))) {
			/* an R Markdown chunk with `eval = FALSE` is not run */
			inChunk = sweave || !/\beval\s*=\s*(FALSE|F)\b/.test(line);
			return '';
		}
		if(inChunk && (sweave ? /^\s*@\s*$/.test(line) : /^\s*```+\s*$/.test(line))) {
			inChunk = false;
			return '';
		}
		return inChunk ? line : '';
	}).join('\n');
}

/** the packages a vignette's `\VignetteDepends{}` and `\VignetteEngine{pkg::engine}` require */
function vignetteDepends(text: string): string[] {
	const result: string[] = [];
	for(const match of text.matchAll(/\\VignetteDepends\{([^}]*)\}/g)) {
		result.push(...match[1].split(',').map(s => s.trim()).filter(s => s !== ''));
	}
	const engine = /\\VignetteEngine\{([A-Za-z][A-Za-z0-9.]*)::[^}]*\}/.exec(text);
	if(engine) {
		result.push(engine[1]);
	}
	return result;
}

/** the index of the brace closing the one opened at `open`, honoring Rd escapes, `-1` if unbalanced */
export function closingBrace(text: string, open: number): number {
	let depth = 0;
	for(let i = open; i < text.length; i++) {
		const c = text[i];
		if(c === '\\') {
			i++;
		} else if(c === '%') {
			/* an Rd comment runs to the end of the line */
			const eol = text.indexOf('\n', i);
			if(eol < 0) {
				return -1;
			}
			i = eol;
		} else if(c === '{') {
			depth++;
		} else if(c === '}' && --depth === 0) {
			return i;
		}
	}
	return -1;
}

/**
 * The code of the `\examples{}` section of an Rd page, as `R CMD check` runs it: `\dontrun{}` is dropped,
 * `\donttest{}`, `\dontshow{}` and `\testonly{}` are kept, Rd escapes are undone. Lines keep their place.
 * `undefined` if the page has no examples.
 */
export function rdExamples(rd: string): { code: string, lineOffset: number } | undefined {
	const start = rd.search(/\\examples\s*\{/);
	if(start < 0) {
		return undefined;
	}
	const open = rd.indexOf('{', start);
	const close = closingBrace(rd, open);
	if(close < 0) {
		return undefined;
	}
	let body = rd.slice(open + 1, close);
	/* drop \dontrun{...}, keeping its line breaks */
	for(let at = body.search(/\\dontrun\s*\{/); at >= 0; at = body.search(/\\dontrun\s*\{/)) {
		const o = body.indexOf('{', at);
		const c = closingBrace(body, o);
		if(c < 0) {
			break;
		}
		body = body.slice(0, at) + body.slice(at, c + 1).replace(/[^\n]/g, '') + body.slice(c + 1);
	}
	/* keep the content of the other wrappers, dropping the macro and its braces */
	for(let m = /\\(donttest|dontshow|testonly|dontdiff)\s*\{/.exec(body); m !== null; m = /\\(donttest|dontshow|testonly|dontdiff)\s*\{/.exec(body)) {
		const o = body.indexOf('{', m.index);
		const c = closingBrace(body, o);
		if(c < 0) {
			break;
		}
		body = body.slice(0, m.index) + body.slice(o + 1, c) + body.slice(c + 1);
	}
	const code = body.split('\n').map(line => {
		const comment = line.search(/(?<!\\)%/);
		return (comment >= 0 ? line.slice(0, comment) : line).replace(/\\([%{}\\])/g, '$1');
	}).join('\n');
	return { code, lineOffset: rd.slice(0, open).split('\n').length };
}

/** The code of a package `R CMD check` looks at besides `R/`: the tests, the vignettes, and the examples of the manual. */
export function packageCode(files: PackageFiles): PackageCode[] {
	const result: PackageCode[] = [];
	for(const { relative, isDirectory } of files.entries) {
		if(isDirectory) {
			continue;
		}
		if(isTestFile(relative)) {
			const code = files.read(relative);
			if(code !== undefined) {
				result.push({ origin: 'tests', file: relative, code, lineOffset: 1 });
			}
		} else if(/^vignettes\/[^/]+\.(Rmd|Rnw|Rmarkdown|qmd|R)$/i.test(relative)) {
			const text = files.read(relative);
			if(text !== undefined) {
				const code = /\.R$/i.test(relative) ? text : vignetteChunks(text, /\.Rnw$/i.test(relative));
				result.push({ origin: 'vignettes', file: relative, code, depends: vignetteDepends(text), lineOffset: 1 });
			}
		} else if(/^man\/[^/]+\.Rd$/i.test(relative)) {
			const text = files.read(relative);
			const examples = text === undefined ? undefined : rdExamples(text);
			if(examples !== undefined) {
				result.push({ origin: 'examples', file: relative, ...examples });
			}
		}
	}
	return result;
}
