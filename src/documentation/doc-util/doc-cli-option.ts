/** Automatically provides hover over with the documentation for these! */
import { scripts } from '../../cli/common/scripts-info';
import { guard } from '../../util/assert';
import { textWithTooltip } from '../../util/html-hover-over';
import type { OptionDefinition } from 'command-line-usage';
import { flowrMainOptionDefinitions } from '../../cli/flowr-main-options';
import { getReplCommands } from '../../cli/repl/commands/repl-commands';

type ScriptOptions<Type extends keyof typeof scripts | 'flowr'> =
	Type extends keyof typeof scripts ? typeof scripts[Type]['options'][number]['name'] :
		Type extends 'flowr' ? typeof flowrMainOptionDefinitions[number]['name'] : never;

export function getCliLongOptionOf<
	ScriptName extends keyof typeof scripts | 'flowr',
	OptionName extends ScriptOptions<ScriptName>
>(scriptName: ScriptName, optionName: OptionName, withAlias = false, quote = true): string {
	const script: OptionDefinition[] = scriptName === 'flowr' ? flowrMainOptionDefinitions : scripts[scriptName].options;
	guard(script !== undefined, () => `Unknown script ${scriptName}, pick one of ${JSON.stringify(Object.keys(scripts))}.`);
	const option = script.find(({ name }) => name === optionName);
	guard(option !== undefined, () => `Unknown option ${optionName}, pick one of ${JSON.stringify(script.map(o => o.name))}.`);
	const char = quote ? '`' : '';
	const alias = withAlias && option.alias ? ' (alias:' + textWithTooltip(`${char}-${option.alias}${char}`, option.description) + ')' : '';
	const ligatureBreaker = quote ? '' : '<span/>';
	// span ensures split even with ligatures
	return textWithTooltip(`${char}-${ligatureBreaker}-${optionName}${char}`, 'Description (Command Line Argument): ' + option.description) + alias;
}

export function multipleCliOptions<
	ScriptName extends keyof typeof scripts | 'flowr',
	OptionName extends ScriptOptions<ScriptName>
>(scriptName: ScriptName, ...options: OptionName[]): string {
	return options.map(o => getCliLongOptionOf(scriptName, o, false, true)).join(' ');
}

export function getReplCommand(commandName: string, quote = true, showStar = false): string {
	const availableNames = getReplCommands();
	const commands = availableNames[commandName];
	guard(commands !== undefined, () => `Unknown command ${commandName}, pick one of ${JSON.stringify(Object.keys(availableNames))}.`);
	const char = quote ? '`' : '';
	const aliases = commands.aliases.length > 0 ? ' (aliases: ' + commands.aliases.map(a => `:${a}`).join(', ') + ')' : '';
	const starredComment = commandName.endsWith('*') ? ', starred version' : '';
	const baseDescription = commandName.endsWith('*') ? '; Base Command: ' + availableNames[commandName.slice(0, -1)].description : '';
	return textWithTooltip(`${char}:${commandName}${showStar ? '[*]' : ''}${char}`,
		`Description (Repl Command${starredComment}): ` + commands.description + baseDescription + aliases);
}
