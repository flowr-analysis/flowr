import { date2string } from '../../util/time'
import path from 'path'
import fs from 'fs'

type FileDescriptor = number

/**
 * Provides cached open connections for all files to connect.
 * allowing to append to the same file often.
 * <p>
 * While we could simply reopen these files, it is safer/more performant to keep the connection open.
 */
export class StatisticFileProvider {
  public readonly statisticsDirectory: string
  private readonly connections = new Map<string, FileDescriptor>()

  constructor(statisticsDirectory = `./statistics-out-${date2string(new Date())}`)  {
    this.statisticsDirectory = statisticsDirectory

    // just to make sure, that they are closed
    process.on('beforeExit', () => {
      this.connections.forEach((fd) => {
        fs.closeSync(fd)
      })
    })
  }

  /**
   * @param name - the name of the feature {@link Feature#name}
   * @param fn - the name of the feature-aspect to record
   */
  private statisticsFile(name: string, fn: string): string {
    return path.join(this.statisticsDirectory, name, `${fn}.txt`)
  }

  /**
   * Append the given content to the information for a feature of the given name and function.
   */
  public append(name: string, fn: string | number | symbol, content: string): void {
    const descriptor = this.getHandle(name, String(fn))
    fs.appendFileSync(descriptor, content + '\n', 'utf8')
  }

  private getHandle(name: string, fn: string): FileDescriptor {
    const key = `${name}-${fn}`
    const fileHandle = this.connections.get(key)
    if (fileHandle) {
      return fileHandle
    }

    // open the connection and ensure the location
    const filepath = this.statisticsFile(name, String(fn))

    const dirpath = path.dirname(filepath)
    if (!fs.existsSync(dirpath)) {
      fs.mkdirSync(dirpath, { recursive: true })
    }
    const fileDescriptor = fs.openSync(filepath, 'a')
    this.connections.set(key, fileDescriptor)
    return fileDescriptor
  }
}
