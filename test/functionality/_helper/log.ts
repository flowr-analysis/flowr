import { log, LogLevel } from '../../../src/util/log';
import { serverLog } from '../../../src/cli/repl/server/server';

/**
 * Update the minimum level of all flowr loggers.
 * @param minLevel - The new minimum level to show messages from (inclusive)
 * @param log2File - Whether to log to a file as well
 */
export function setMinLevelOfAllLogs(minLevel: LogLevel, log2File = false) {
	if(log2File) {
		log.logToFile();
	}
	log.updateSettings(logger => {
		logger.settings.minLevel = minLevel;
	});
	serverLog.settings.minLevel = LogLevel.Fatal;
}
