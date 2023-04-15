import { getStoredTokenMap, retrieveAstFromRCode } from './r-bridge/retriever'
import * as readline from 'readline'
import { RShell } from './r-bridge/shell'
import { log } from './util/log'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })

log.logToFile()

const shell = new RShell()
shell.tryToInjectHomeLibPath()
let tokenMap: null | Record<string, string> = null

async function fun(): Promise<void> {
  if (tokenMap === null) {
    tokenMap = await getStoredTokenMap(shell)
  }
  rl.write('R> ')
  rl.once('line', (answer) => {
    void retrieveAstFromRCode({
      request: 'text',
      content: answer,
      attachSourceInformation: true,
      ensurePackageInstalled: true
    }, tokenMap as Record<string, string>, shell).then(async json => {
      console.log(JSON.stringify(json))
      await fun()
    })
  })
}

void fun()
