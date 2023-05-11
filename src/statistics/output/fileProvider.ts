import { date2string } from '../../util/time'

/**
 * Provides cached open connections for all files to connect.
 * allowing to append to the same file often.
 * <p>
 * While we could simply reopen these files, it is safer/more performant to keep the connection open.
 */
export class StatisticFileProvider {
  public readonly statisticsDirectory: string

  constructor(statisticsDirectory = `./statistics-out-${date2string(new Date())}`)  {
    this.statisticsDirectory = statisticsDirectory
  }

}
