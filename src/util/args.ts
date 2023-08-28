/**
 * Just to avoid another library for splitting arguments, we use this module to provide what we need.
 *
 * @module
 */

/**
 * Given an input string like `a "b c" d` this splits the arguments similar to common shell interpreters (i.e., `a`, `b c`, and `d`).
 */
export function splitArguments(inputString: string): string[] {
	const args = []
	let current = ''
	let inQuotes = false
	let escaped = false

	for(const c of inputString) {
		if(escaped) {
			escaped = false
			switch(c) {
				case 'n': current += '\n'; break
				case 't': current += '\t'; break
				case 'r': current += '\r'; break
				case 'v': current += '\v'; break
				case 'f': current += '\f'; break
				case 'b': current += '\b'; break
				default: current += c
			}
		} else if(c === ' ' && !inQuotes && current !== '') {
			args.push(current)
			current = ''
		} else if(c === '"' || c === "'") {
			inQuotes = !inQuotes
		} else if(c === '\\') {
			escaped = true
		} else {
			current += c
		}
	}

	if(current !== '') {
		args.push(current)
	}

	return args
}
