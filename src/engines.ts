import { type FlowrConfigOptions, type KnownEngines , getEngineConfig } from './config';
import { RShell, RShellReviveOptions } from './r-bridge/shell';
import { bold, ColorEffect, Colors, formatter, italic } from './util/text/ansi';
import { TreeSitterExecutor } from './r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { log } from './util/log';

/**
 * Retrieve all requested engine instance.
 * Please make sure that if this includes the R engine, that you properly shut it down again!
 */
export async function retrieveEngineInstances(config: FlowrConfigOptions, defaultOnly = false): Promise<{ engines: KnownEngines, default: keyof KnownEngines }> {
	const engines: KnownEngines = {};
	if(getEngineConfig(config, 'r-shell') && (!defaultOnly || config.defaultEngine === 'r-shell')) {
		// we keep an active shell session to allow other parse investigations :)
		engines['r-shell'] = new RShell(getEngineConfig(config, 'r-shell'), {
			revive:   RShellReviveOptions.Always,
			onRevive: (code, signal) => {
				const signalText = signal == null ? '' : ` and signal ${signal}`;
				console.log(formatter.format(`R process exited with code ${code}${signalText}. Restarting...`, { color: Colors.Magenta, effect: ColorEffect.Foreground }));
				console.log(italic(`If you want to exit, press either Ctrl+C twice, or enter ${bold(':quit')}`));
			}
		});
	}
	if(getEngineConfig(config, 'tree-sitter') && (!defaultOnly || config.defaultEngine === 'tree-sitter')) {
		await TreeSitterExecutor.initTreeSitter(getEngineConfig(config, 'tree-sitter'));
		engines['tree-sitter'] = new TreeSitterExecutor();
	}
	let defaultEngine = config.defaultEngine;
	if(!defaultEngine || !engines[defaultEngine]) {
		// if a default engine isn't specified, we just take the first one we have
		defaultEngine = Object.keys(engines)[0] as keyof KnownEngines;
	}
	log.info(`Using engines ${Object.keys(engines).join(', ')} with default ${defaultEngine}`);
	return { engines, default: defaultEngine };
}
