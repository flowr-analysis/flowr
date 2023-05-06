import { RShell } from '../r-bridge/shell'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'

log.updateSettings(l => l.settings.minLevel = LogLevel.error)

const shell = new RShell()
shell.tryToInjectHomeLibPath()

const processArguments = process.argv.slice(2)

console.log(`processing ${processArguments.length} files`)


if (processArguments.length === 0) {
  console.error('Please provide at least one file to generate statistics for')
  process.exit(1)
}

async function getStats() {
  const stats = await extract(shell,
    file => console.log(`processing ${file.content}`),
    ...processArguments.map(file => ({ request: 'file' as const, content: file }))
  )
  console.log(JSON.stringify(stats))
  shell.close()
}

void getStats()

