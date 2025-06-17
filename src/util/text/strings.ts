import path from 'path';

/**
 * Check if the given string starts and ends with the given letter
 */
export function startAndEndsWith(str: string, letter: string): boolean {
	return str.startsWith(letter) && str.endsWith(letter);
}

/**
 * Removes all whitespace in the given string
 */
export function withoutWhitespace(output: string): string {
	return output.replace(/\s/g,'');
}

/**
 * Find the longest common prefix in an array of strings
 */
export function longestCommonPrefix(strings: string[]): string {
	if(strings.length === 0) {
		return '';
	}

	let prefix = strings[0];

	for(const str of strings) {
		if(prefix.length === 0) {
			break;
		}
		let i = 0;
		while(i < prefix.length && prefix[i] === str[i]) {
			i++;
		}
		if(i !== prefix.length) {
			prefix = prefix.slice(0, i);
		}
	}

	return prefix;
}

/**
 * Join a list of strings, but with special handling for the last element/scenarios in which the array contains exactly two elements.
 * The goal is to create (partial) sentences like `a, b, and c` or `a and b`.
 */
export function joinWithLast(strs: readonly string[], { join = ', ', last = ', and ', joinTwo = ' and ' }: { join?: string, last?: string, joinTwo?: string } = {}): string {
	if(strs.length <= 1) {
		return strs.join('');
	} else if(strs.length === 2) {
		return strs.join(joinTwo);
	}
	return strs.slice(0, -1).join(join) + last + strs[strs.length - 1];
}

/**
 * Check if the given path is an absolute path.
 */
export function isAbsolutePath(p: string, regex: RegExp | undefined): boolean {
	return regex?.test(p) || p.startsWith('/') || p.startsWith('\\') ||
		/[a-zA-Z]:[\\/]/.test(p) || // Windows absolute path
		path.normalize(p + '/') === path.normalize(path.resolve(p) + '/');
}


const CorrespondingClose = {
	'(': ')',
	'[': ']',
	'{': '}'
} as const;

/** collect '-' at the start until '[' or '(' is reached, then drop the same from the end if present otherwise return the value as is */
export function dropRawStringSurround(value: string): string {
	const dashCount = value.match(/^-*/)?.[0].length ?? 0;
	const open = value[dashCount];
	if(open === '[' || open === '(' || open === '{') {
		// if the value starts with a dash and then a bracket, we drop the dashes at the end
		const end = value.endsWith(CorrespondingClose[open] + '-'.repeat(dashCount)) ? dashCount : undefined;
		if(end !== undefined) {
			return value.slice(dashCount + 1, -end - 1);
		} else {
			return value;
		}
	}
	return value;
}

