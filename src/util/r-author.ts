import { splitAtEscapeSensitive } from './text/args';
import { isNotUndefined } from './assert';
import { compactRecord } from './objects';
import { removeRQuotes } from '../r-bridge/retriever';

/** https://r-pkgs.org/description.html#sec-description-authors-at-r */
export enum AuthorRole {
	/** the creator or maintainer, the person you should bother if you have problems. Despite being short for “creator”, this is the correct role to use for the current maintainer, even if they are not the initial creator of the package. */
	Creator = 'cre',
	/** authors, those who have made significant contributions to the package. */
	Author = 'aut',
	/** contributors, those who have made smaller contributions, like patches. */
	Contributor = 'ctb',
	/**  copyright holder. This is used to list additional copyright holders who are not authors, typically companies, like an employer of one or more of the authors. */
	CopyrightHolder = 'cph',
	/** funder, the people or organizations that have provided financial support for the development of the package. */
	Funder = 'fnd'
}

/**
 * Information about an author.
 * See {@link parseRAuthorString} for parsing R `Authors@R` strings, and {@link rAuthorInfoToReadable} for printing them.
 */
export interface RAuthorInfo {
	/** The name (components) of the author. */
	readonly name:     string[];
	/** The email of the author, if available. */
	readonly email?:   string;
	/** The roles of the author in the project. */
	readonly roles:    AuthorRole[];
	/** The ORCID of the author, if available. */
	readonly orcid?:   string;
	/** Any additional comments about the author. */
	readonly comment?: string[];
}

/**
 * Convert structured R author information into an R `Authors@R` string.
 */
export function rAuthorInfoToReadable(author: RAuthorInfo): string {
	const nameStr = author.name.join(' ');
	const emailStr = author.email ? ` <${author.email}>` : '';
	const rolesStr = author.roles.length > 0 ? ` [${author.roles.join(', ')}]` : '';
	const orcidStr = author.orcid ? ` (ORCID: ${author.orcid})` : '';
	const commentStr = author.comment && author.comment.length > 0 ? ` {${author.comment.join('; ')}}` : '';
	return `${nameStr}${emailStr}${rolesStr}${orcidStr}${commentStr}`;
}

/**
 * Parse an R `Authors@R` string into structured author information.
 * These are mostly found in `R` DESCRIPTION files and are a vector of `person()` calls.
 * For now, this works *without* the full dataflow engine, so complex cases may not be parsed correctly.
 */
export function parseRAuthorString(authorString: string): RAuthorInfo[] {
	const str = authorString.trim();
	if(str.startsWith('c(') && str.endsWith(')')) {
		const inner = str.slice(2, -1).trim();
		const parts = joinPartsWithVectors(splitAtEscapeSensitive(inner, false, ','));
		const authors: RAuthorInfo[] = [];
		for(const part of parts) {
			const author = parseRPersonCall(part);
			if(author) {
				authors.push(author);
			}
		}
		return authors;
	} else if(str.startsWith('person(') && str.endsWith(')')) {
		const author = parseRPersonCall(str);
		return author ? [author] : [];
	}
	return [];
}

function splitArgNameValue(arg: string): { name?: string, value: string | undefined } {
	const eqIndex = arg.indexOf('=');
	if(eqIndex === -1) {
		const trimmedArg = arg.trim();
		return { value: trimmedArg.length === 0 ? undefined : trimmedArg };
	} else {
		const name = arg.slice(0, eqIndex).trim();
		const value = arg.slice(eqIndex + 1).trim();
		return { name, value };
	}
}

// Joins parts that may be split by c(...) vectors back together, ...
function joinPartsWithVectors(parts: string[]): string[] {
	const result = [];
	let buffer = [];
	let parenthesisLevel = 0;

	for(const part of parts) {
		const trimmed = part.trim();
		// check whether parenthesis are balanced
		for(const char of trimmed) {
			if(char === '(') {
				parenthesisLevel++;
			} else if(char === ')') {
				parenthesisLevel--;
			}
		}
		if(parenthesisLevel === 0) {
			buffer.push(trimmed);
			result.push(buffer.join(', '));
			buffer = [];
		} else {
			buffer.push(trimmed);
		}
	}
	if(buffer.length > 0) {
		result.push(buffer.join(', '));
	}
	return result;
}

const defaultPosArgNames = ['given', 'family', 'middle', 'email', 'role', 'comment', 'first', 'last'] as const;

function splitVector(roleStr: string) {
	if(roleStr.startsWith('c(') && roleStr.endsWith(')')) {
		const inner = roleStr.slice(2, -1).trim();
		return joinPartsWithVectors(splitAtEscapeSensitive(inner, false, ','));
	} else {
		return [roleStr.trim()];
	}
}

function parseRoles(roleStr: string | undefined): AuthorRole[] {
	if(!roleStr) {
		return [];
	}
	const roles: AuthorRole[] = [];
	const parts = splitVector(roleStr);
	for(const part of parts) {
		const trimmed = part.trim();
		const roleValue = removeRQuotes(trimmed);
		if(Object.values(AuthorRole).includes(roleValue as AuthorRole)) {
			roles.push(roleValue as AuthorRole);
		}
	}
	return roles;
}


function parseComments(commentStr: string | undefined): { contents: string[], orcid: string | undefined } | undefined {
	if(!commentStr) {
		return undefined;
	}
	const comments: string[] = [];
	const parts = splitVector(commentStr);
	let orcid: string | undefined = undefined;
	for(const part of parts) {
		const trimmed = part.trim();
		const commentValue = removeRQuotes(trimmed);
		if(/ORCID\s*=/ig.test(commentValue)) {
			const orcidIndex = commentValue.indexOf('=');
			if(orcidIndex !== -1) {
				orcid = removeRQuotes(commentValue.slice(orcidIndex + 1).trim());
			}
			continue;
		}
		comments.push(commentValue);
	}
	return comments.length > 0 || orcid ? { contents: comments, orcid: orcid } : undefined;
}

function assignArg(argMap: Map<string, string | undefined>, split: {
	name?: string;
	value: string | undefined
}) {
	argMap.set(
		split.name as (typeof defaultPosArgNames)[number],
		split.value === undefined || split.value?.length === 0 ? undefined : removeRQuotes(split.value)
	);
}

function parseRPersonCall(personCall: string): RAuthorInfo | undefined {
	/* function(given = NULL, family = NULL, middle = NULL,
         email = NULL, role = NULL, comment = NULL,
         first = NULL, last = NULL), but we neither use nor support full R semantics here for now */
	personCall = personCall.trim();
	if(!personCall.startsWith('person(') || !personCall.endsWith(')')) {
		return undefined;
	}
	const inner = personCall.slice(7, -1).trim();
	// these may also split unescaped commas inside c(...)
	const parArgs = joinPartsWithVectors(splitAtEscapeSensitive(inner, false, ','));
	const argMap: Map<(typeof defaultPosArgNames)[number], string | undefined> = new Map();
	const unnamed: string[] = [];
	for(const arg of parArgs) {
		const split = splitArgNameValue(arg.trim());
		if(!split.name) {
			unnamed.push(arg.trim());
			continue;
		}
		assignArg(argMap, split);
	}
	// assign unnamed args in order
	for(let i = 0; i < unnamed.length; i++) {
		if(i >= defaultPosArgNames.length) {
			break;
		}
		const argIdx = defaultPosArgNames.findIndex(x => !argMap.has(x));
		if(argIdx === -1) {
			break;
		}
		const argName = defaultPosArgNames[argIdx];
		const value = unnamed[i];
		assignArg(argMap, { name: argName, value });
	}
	const comments = parseComments(argMap.get('comment'));
	return compactRecord({
		name:    [argMap.get('given') ?? argMap.get('first'), argMap.get('middle'), argMap.get('family') ?? argMap.get('last')].filter(isNotUndefined),
		email:   argMap.get('email'),
		roles:   parseRoles(argMap.get('role')),
		comment: comments?.contents,
		orcid:   comments?.orcid
	});
}

function collectUntil(source: string, anyOf: RegExp): { collected: string; rest: string } {
	let collected = '';
	let i = 0;
	while(i < source.length && !anyOf.test(source[i])) {
		collected += source[i];
		i++;
	}
	return { collected, rest: source.slice(i) };
}

/**
 * In contrast to `parseRAuthorString`, this function parses simple textual author strings,
 * like `First Middle Last <email> [roles] (comment)...`. It does not support the full R `person()` syntax.
 */
export function parseTextualAuthorString(authorString: string, addRoles: AuthorRole[] = []): RAuthorInfo[] {
	const parts = authorString.split(/\s+and\s+/);
	const authors: RAuthorInfo[] = [];
	for(const part of parts) {
		const name = collectUntil(part.trim(), /[<[(]/);
		const others = parseOnRest(name.rest);

		authors.push(compactRecord({
			name:    name.collected.trim().split(/\s+/),
			email:   others.email,
			roles:   others.roles.concat(addRoles),
			comment: others.comment ? [others.comment] : undefined
		}));
	}
	return authors;
}

function parseOnRest(rest: string): { email?: string; roles: AuthorRole[]; comment?: string } {
	let email: string | undefined = undefined;
	let roles: AuthorRole[] = [];
	let comment: string | undefined = undefined;
	while(rest.length > 0) {
		rest = rest.trim();
		switch(rest[0]) {
			case '<': {
				const emailEnd = rest.indexOf('>');
				if(emailEnd !== -1) {
					email = rest.slice(1, emailEnd).trim();
					rest = rest.slice(emailEnd + 1);
				} else {
					rest = '';
				}
				break;
			}
			case '[': {
				const rolesEnd = rest.indexOf(']');
				if(rolesEnd !== -1) {
					const rolesStr = rest.slice(1, rolesEnd).trim();
					roles = rolesStr.split(/\s*,\s*/).map(r => r as AuthorRole);
					rest = rest.slice(rolesEnd + 1);
				} else {
					rest = '';
				}
				break;
			}
			case '(': {
				const commentEnd = rest.indexOf(')');
				if(commentEnd !== -1) {
					comment = rest.slice(1, commentEnd).trim();
					rest = rest.slice(commentEnd + 1);
				} else {
					rest = '';
				}
				break;
			}
			default: {
				rest = '';
				break;
			}
		}
	}
	return { email, roles, comment };
}
