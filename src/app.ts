import { retrieveAstFromRCode } from './r-bridge/parse'
import * as readline from 'readline'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })

function fun(): void {
  rl.write('R> ')
  rl.once('line', (answer) => {
    void retrieveAstFromRCode({
      request: 'text',
      content: answer,
      attachSourceInformation: true
    }).then(json => {
      console.log(JSON.stringify(json))
      fun()
    })
  })
}

fun()
