import { RShellSession } from './r-bridge/rshell'

console.log('Hello World')

const executor = new RShellSession()

executor.sendCommand("print('Hello World')")
