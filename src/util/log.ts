import { type ILogObj, type ISettingsParam, Logger } from 'tslog';
import { createWriteStream } from 'fs';
/* type-only, the package itself is optional and resolved at call time (see `logToFile`) */
import type { Options, RotatingFileStream } from 'rotating-file-stream';

export const expensiveTrace = (log: Logger<ILogObj> | undefined, supplier: () => string): void => {
	if(log !== undefined && log.settings.minLevel <= LogLevel.Trace) {
		log.trace(supplier());
	}
};

/** The rotating stream, or `undefined` if the optional dependency is not installed. */
function rotatingStream(filename: string, options: Options): RotatingFileStream | undefined {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- optional dependency, absent by design in slim installs
		return (require('rotating-file-stream') as typeof import('rotating-file-stream')).createStream(filename, options);
	} catch{
		return undefined;
	}
}

export class FlowrLogger extends Logger<ILogObj> {
	/** by keeping track of all children we can propagate updates of the settings (e.g., in tests) */
	private readonly childLoggers: Logger<ILogObj>[] = [];

	public getSubLogger(
		settings?: ISettingsParam<ILogObj>,
		logObj?: ILogObj
	): Logger<ILogObj> {
		const newSubLogger = super.getSubLogger(settings, logObj);
		this.childLoggers.push(newSubLogger);
		return newSubLogger;
	}

	public updateSettings(updater: (logger: Logger<ILogObj>) => void): void {
		updater(this);
		this.childLoggers.forEach((child) => {
			updater(child);
		});
	}

	/**
	 * make the logger log to a file as well
	 *
	 * Rotation needs the optional `rotating-file-stream` dependency. Without it (the slim runtime images install with
	 * `--omit=optional`) the log is appended to a single file instead.
	 */
	public logToFile(
		filename = 'flowr.log',
		options: Options = {
			size:     '10M',
			interval: '1d',
			compress: 'gzip',
		}
	): void {
		const stream = rotatingStream(filename, options) ?? createWriteStream(filename, { flags: 'a' });

		log.attachTransport((logObj) => {
			stream.write(`${JSON.stringify(logObj)}\n`);
		});
	}
}

// based on https://tslog.js.org/#/?id=minlevel
// noinspection JSUnusedGlobalSymbols
export const enum LogLevel {
	Silly = 0,
	Trace = 1,
	Debug = 2,
	Info = 3,
	Warn = 4,
	Error = 5,
	Fatal = 6
}

export const LogLevelNames = {
	silly: LogLevel.Silly,
	trace: LogLevel.Trace,
	debug: LogLevel.Debug,
	info:  LogLevel.Info,
	warn:  LogLevel.Warn,
	error: LogLevel.Error,
	fatal: LogLevel.Fatal
} as const;
export type LogLevelName = keyof typeof LogLevelNames;

/** Set the global minimum log level by name. */
export function setLogLevel(level: LogLevelName): void {
	log.updateSettings(l => {
		l.settings.minLevel = LogLevelNames[level];
	});
}

function getActiveLog(): FlowrLogger {
	return new FlowrLogger({
		// set the default minimum level as Warn, and let all apps
		// (like the REPL) update it to whatever they want it to be
		minLevel:        LogLevel.Warn,
		type:            'pretty',
		name:            'main',
		stylePrettyLogs: true,
		prettyLogStyles: {
			logLevelName: {
				'*': ['bold', 'black', 'dim']
			}
		}
	});
}

export const log: FlowrLogger = getActiveLog();
