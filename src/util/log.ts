import { type ILogObj, type ISettingsParam, Logger } from 'tslog'
import { createStream, type Options } from 'rotating-file-stream'

class FlowrLogger extends Logger<ILogObj> {
  /** by keeping track of all children we can propagate updates of the settings (e.g., in tests) */

  private readonly childLoggers: Array<Logger<ILogObj>> = []

  public getSubLogger (settings?: ISettingsParam<ILogObj>, logObj?: ILogObj): Logger<ILogObj> {
    const newSubLogger = super.getSubLogger(settings, logObj)
    this.childLoggers.push(newSubLogger)
    return newSubLogger
  }

  public updateSettings (updater: (logger: Logger<ILogObj>) => void): void {
    updater(this)
    this.childLoggers.forEach(child => {
      updater(child)
    })
  }

  /**
   * make the logger log to a file as well
   */
  public logToFile (filename = 'flowr.log', options: Options = {
    size:     '10M',
    interval: '1d',
    compress: 'gzip'
  }): void {
    const stream = createStream(filename, options)

    log.attachTransport(logObj => {
      stream.write(`${JSON.stringify(logObj)}\n`)
    })
  }
}

// based on https://tslog.js.org/#/?id=minlevel
export const enum LogLevel {
  silly = 0,
  trace = 1,
  debug = 2,
  info = 3,
  warn = 4,
  error = 5,
  fatal = 6
}

function getActiveLog (): FlowrLogger {
  return new FlowrLogger({
    type:            'pretty',
    name:            'main',
    stylePrettyLogs: true,
    prettyLogStyles: {
      logLevelName: {
        '*': ['bold', 'black', 'dim']
      }
    }
  })
}

export const log: FlowrLogger = getActiveLog()
