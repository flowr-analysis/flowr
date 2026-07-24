/** Automatically provides hover over with the documentation for these! */
import { scripts } from '../../cli/common/scripts-info';
import { guard } from '../../util/assert';
import { textWithTooltip } from '../../util/html-hover-over';
import type { OptionDefinition } from 'command-line-usage';
import { flowrMainOptionDefinitions } from '../../cli/flowr-main-options';
import type { ReplCommandNames } from '../../cli/repl/commands/repl-commands';
import { getReplCommands } from '../../cli/repl/commands/repl-commands';
import { escapeHTML } from './doc-escape';
import { FlowrConfig } from '../../config';
import { schemaPathInfo } from '../../util/schema';
import { FlowrWikiBaseRef } from './doc-files';
import type { AutocompletablePaths } from '../../util/objects';

export type ScriptOptions<Type extends keyof typeof scripts | 'flowr'> =
	Type extends keyof typeof scripts ? typeof scripts[Type]['options'][number]['name'] :
		Type extends 'flowr' ? typeof flowrMainOptionDefinitions[number]['name'] : never;

/**
 * Produce the documentation string for a CLI long option
 */
export function getCliLongOptionOf<
	ScriptName extends keyof typeof scripts | 'flowr',
	OptionName extends ScriptOptions<ScriptName>
>(scriptName: ScriptName, optionName: OptionName, withAlias = false, quote = true): string {
	const script: OptionDefinition[] = scriptName === 'flowr' ? flowrMainOptionDefinitions : scripts[scriptName].options;
	guard(script !== undefined, () => `Unknown script ${scriptName}, pick one of ${JSON.stringify(Object.keys(scripts))}.`);
	const option = script.find(({ name }) => name === optionName);
	guard(option !== undefined, () => `Unknown option ${optionName}, pick one of ${JSON.stringify(script.map(o => o.name))}.`);
	const char = quote ? '`' : '';
	const description = escapeHTML(option.description);
	const alias = withAlias && option.alias ? ' (alias:' + textWithTooltip(`${char}-${option.alias}${char}`, description) + ')' : '';
	const ligatureBreaker = quote ? '' : '<span/>';
	// span ensures split even with ligatures
	return textWithTooltip(`${char}-${ligatureBreaker}-${optionName}${char}`, 'Description (Command Line Argument): ' + description) + alias;
}


/**
 * Produce the documentation string for multiple CLI long options
 */
export function multipleCliOptions<
	ScriptName extends keyof typeof scripts | 'flowr',
	OptionName extends ScriptOptions<ScriptName>
>(scriptName: ScriptName, ...options: OptionName[]): string {
	return options.map(o => getCliLongOptionOf(scriptName, o, false, true)).join(' ');
}


/**
 * Produce a documentation link for a flowR configuration option (e.g. `solver.sigdb.enabled`).
 * The link points at the configuration section of the Interface wiki page and carries the option's
 * schema type, description, and any enumerated values as a hover tooltip.
 * @param path  - The (autocompleted) `.`-separated configuration path.
 * @param quote - Whether to render the path as inline code. Default is `true`.
 */
export function getConfigOption(path: AutocompletablePaths<FlowrConfig>, quote = true): string {
	const info = schemaPathInfo(FlowrConfig.Schema, path.split('.'));
	let tooltip = `Configuration Option (${info.type ?? 'option'})`;
	if(info.description) {
		tooltip += `: ${info.description}`;
	}
	if(info.valids && info.valids.length > 0) {
		tooltip += ` (one of ${info.valids.map(v => JSON.stringify(v)).join(', ')})`;
	}
	const label = quote ? `<code>${escapeHTML(path)}</code>` : escapeHTML(path);
	return `<a href="${FlowrWikiBaseRef}/Interface#configuring-flowr" title=${JSON.stringify(escapeHTML(tooltip))}>${label}</a>`;
}

/**
 * Produce the documentation string for a REPL command
 */
export function getReplCommand(commandName: ReplCommandNames | string, quote = true, showStar = false): string {
	const availableNames = getReplCommands();
	const commands = availableNames[commandName];
	guard(commands !== undefined, () => `Unknown command ${commandName}, pick one of ${JSON.stringify(Object.keys(availableNames))}.`);
	const char = quote ? '`' : '';
	const aliases = commands.aliases.length > 0 ? ' (aliases: ' + commands.aliases.map(a => `:${a}`).join(', ') + ')' : '';
	const starredComment = commandName.endsWith('*') ? ', starred version' : '';
	const baseDescription = commandName.endsWith('*') ? '; Base Command: ' + availableNames[commandName.slice(0, -1) as ReplCommandNames].description : '';
	return textWithTooltip(`${char}:${commandName}${showStar ? '[*]' : ''}${char}`,
		`Description (Repl Command${starredComment}): ` + commands.description + baseDescription + aliases);
}
