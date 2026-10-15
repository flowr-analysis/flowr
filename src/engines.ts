import { FlowrConfig, type KnownEngines } from './config';
import { RShell, RShellReviveOptions } from './r-bridge/shell';
import { bold, ColorEffect, Colors, formatter, italic } from './util/text/ansi';
import { TreeSitterExecutor } from './r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { log } from './util/log';
import { SecureMode } from './util/secure-mode';

/**
 * Retrieve all requested engine instance.
 * Please make sure that if this includes the R engine, that you properly shut it down again!
 */
export async function retrieveEngineInstances(config: FlowrConfig, defaultOnly = false): Promise<{ engines: KnownEngines, default: keyof KnownEngines }> {
	const engines: KnownEngines = {};
	const rShellWanted = FlowrConfig.getForEngine(config, 'r-shell') && (!defaultOnly || config.defaultEngine === 'r-shell');
	if(rShellWanted && SecureMode.isEnabled()) {
		log.warn('The secure mode forbids starting R, so the r-shell engine is not available');
	} else if(rShellWanted) {
		// we keep an active shell session to allow other parse investigations :)
		engines['r-shell'] = new RShell(FlowrConfig.getForEngine(config, 'r-shell'), {
			revive:   RShellReviveOptions.Always,
			onRevive: (code, signal) => {
				const signalText = signal == null ? '' : ` and signal ${signal}`;
				console.log(formatter.format(`R process exited with code ${code}${signalText}. Restarting...`, { color: Colors.Magenta, effect: ColorEffect.Foreground }));
				console.log(italic(`If you want to exit, press either Ctrl+C twice, or enter ${bold(':quit')}`));
			}
		});
	}
	// in secure mode, tree-sitter is the only engine, so we start it whenever r-shell was refused
	const treeSitterForced = SecureMode.isEnabled() && rShellWanted;
	const treeSitter = FlowrConfig.getForEngine(config, 'tree-sitter') ?? (treeSitterForced ? { type: 'tree-sitter' } as const : undefined);
	if(treeSitter && (!defaultOnly || config.defaultEngine === 'tree-sitter' || treeSitterForced)) {
		await TreeSitterExecutor.initTreeSitter(treeSitter);
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
