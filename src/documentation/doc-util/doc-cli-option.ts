/** Automatically provides hover over with the documentation for these! */
import { scripts } from '../../cli/common/scripts-info';
import { guard } from '../../util/assert';
import { textWithTooltip } from './doc-hover-over';
import type { OptionDefinition } from 'command-line-usage';
import { flowrMainOptionDefinitions } from '../../cli/flowr-main-options';

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
	return textWithTooltip(`${char}-${ligatureBreaker}-${optionName}${char}`, 'Description: ' + option.description) + alias;
}

export function multipleCliOptions<
	ScriptName extends keyof typeof scripts | 'flowr',
	OptionName extends ScriptOptions<ScriptName>
>(scriptName: ScriptName, ...options: OptionName[]): string {
	return options.map(o => getCliLongOptionOf(scriptName, o, false, true)).join(' ');
}
