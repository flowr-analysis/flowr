import type { SigNativeRoutineInfo } from '../../src/project/sigdb/schema';
import { packageSourceUrl } from '../../src/util/r-package-urls';
import { isBaseRPackage } from '../../src/util/r-base-packages';

/* The native routines of the packages the playground carries: which ones a foreign function call may name, and where they are defined. */

/** one routine as the page carries it: `[name, rNames, iface, lang, file, line, endLine, column]`, `''`/`0` where not known */
export type BakedRoutine = readonly [name: string, rNames: string, iface: string, lang: string, file: string, line: number, endLine: number, column: number];

/** the routine as the page bakes it */
export function bakeRoutine(r: SigNativeRoutineInfo): BakedRoutine {
	return [r.name, (r.rNames ?? []).join(' '), r.iface ?? '', r.lang ?? '', r.file ?? '', r.line ?? 0, r.endLine ?? 0, r.column ?? 0];
}

/** the routine back in the database's form, as far as the page carries it */
export function unbakeRoutine([name, rNames, iface, lang, file, line, endLine, column]: BakedRoutine): SigNativeRoutineInfo {
	return {
		name,
		...rNames === '' ? {} : { rNames: rNames.split(' ') },
		...iface === '' ? {} : { iface: iface as SigNativeRoutineInfo['iface'] },
		...lang === '' ? {} : { lang: lang as SigNativeRoutineInfo['lang'] },
		...file === '' ? {} : { file },
		...line > 0 ? { line } : {},
		...endLine > 0 ? { endLine } : {},
		...column > 0 ? { column } : {}
	};
}

/** the foreign function interfaces, whose first argument names the routine */
const Interfaces = new Set(['.Call', '.C', '.Fortran', '.External', '.External2', '.Call.graphics', '.External.graphics']);

/** Where the routine name of a foreign function call is being written at `pos`: the call, what is written so far, and whether in quotes. */
export interface NameArgument {
	readonly call:    string
	/** where the name written so far starts */
	readonly from:    number
	readonly written: string
	readonly quoted:  boolean
	/** the `PACKAGE = "pkg"` the call gives, if it gives one */
	readonly pkg?:    string
}

/** The routine name `pos` sits in, if it is in the first argument of a foreign function call. */
export function nameArgumentAt(text: string, pos: number): NameArgument | undefined {
	const word = /[\w.]*$/.exec(text.slice(0, pos))?.[0] ?? '';
	let at = pos - word.length;
	const quoted = at > 0 && (text[at - 1] === '"' || text[at - 1] === '\'' || text[at - 1] === '`');
	if(quoted) {
		at--;
	}
	const before = /([.\w]+)\s*\(\s*$/.exec(text.slice(Math.max(0, at - 200), at));
	if(before === null || !Interfaces.has(before[1])) {
		return undefined;
	}
	/* what the call gives as `PACKAGE`, read off the rest of the call */
	const rest = text.slice(pos, pos + 2000);
	const close = closingParen(rest);
	const pkg = /PACKAGE\s*=\s*["']([\w.]+)["']/.exec(rest.slice(0, close))?.[1];
	return { call: before[1], from: pos - word.length, written: word, quoted: quoted && text[at] !== '`', ...pkg === undefined ? {} : { pkg } };
}

/** the offset of the `)` closing the call `text` is inside of, its length if none */
function closingParen(text: string): number {
	let depth = 0;
	for(let i = 0; i < text.length; i++) {
		if(text[i] === '(') {
			depth++;
		} else if(text[i] === ')') {
			if(depth === 0) {
				return i;
			}
			depth--;
		}
	}
	return text.length;
}

/** The names a call may give for the routines: the R names `useDynLib` binds for a symbol, the registered name in quotes. */
export function routineNames(routines: readonly SigNativeRoutineInfo[], quoted: boolean): { readonly label: string, readonly routine: SigNativeRoutineInfo }[] {
	return routines.flatMap(routine => (quoted || routine.rNames === undefined ? [routine.name] : routine.rNames).map(label => ({ label, routine })));
}

/** The routine a call names: an R variable by the names `useDynLib` binds, a string by the registered name, then the symbol. */
export function routineNamed(routines: readonly SigNativeRoutineInfo[], name: string, quoted: boolean): SigNativeRoutineInfo | undefined {
	return quoted
		? routines.find(r => r.name === name) ?? routines.find(r => r.symbol === name)
		: routines.find(r => r.rNames?.includes(name)) ?? routines.find(r => r.name === name);
}

/** where the routine is, `file:line`, for a completion's detail */
export function placeOf(routine: SigNativeRoutineInfo): string {
	return routine.file === undefined ? '' : routine.line === undefined ? routine.file : `${routine.file}:${routine.line}`;
}

/** The routine's source online, at the lines of its definition: R's sources for a base package, else CRAN's mirror at the version, see {@link packageSourceUrl}. */
export function sourceUrl(pkg: string, version: string | undefined, routine: SigNativeRoutineInfo): string | undefined {
	return routine.file === undefined ? undefined
		: packageSourceUrl(pkg, { version: version === '' ? undefined : version, base: isBaseRPackage(pkg), file: routine.file, line: routine.line, endLine: routine.endLine });
}
