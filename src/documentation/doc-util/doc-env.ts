import type { IEnvironment } from '../../dataflow/environments/environment';
import { printIdentifier } from '../../util/mermaid/dfg';

export function printEnvironmentToMarkdown(env: IEnvironment | undefined, defaultEnv: IEnvironment): string {
	if(env === undefined) {
		return '?? (error)';
	} else if(env.id === defaultEnv.id) {
		return `_Built-in Environment (${env.memory.size} entries)_`;
	}

	const lines = ['| Name | Definitions |', '|------|-------------|'];
	for(const [name, defs] of env.memory.entries()) {
		const printName = `\`${name}\``;
		lines.push(`| ${printName} | {${defs.map(printIdentifier).join(', ')}} |`);
	}
	return lines.join('\n') + '\n\n<details><summary style="color:gray"> Parent Environment</summary>\n\n' + printEnvironmentToMarkdown(env.parent, defaultEnv) + '\n\n</details>';
}
