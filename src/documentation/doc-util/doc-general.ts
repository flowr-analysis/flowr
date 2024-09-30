export function prefixLines(line: string, prefix: string) {
	return line.split('\n').map(l => `${prefix}${l}`).join('\n');
}
