import * as readline from 'readline'
import { log } from "./util/log"
import { getStoredTokenMap, retrieveAstFromRCode, RShell } from './r-bridge'

const rl = readline.createInterface({
  input:    process.stdin,
  output:   process.stdout,
  terminal: true,
})

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
      request:                 'text',
      content:                 answer,
      attachSourceInformation: true,
      ensurePackageInstalled:  true
    }, tokenMap!, shell).then(async json => {
      console.log(JSON.stringify(json))
      await fun()
    })
  })
}

void fun()
