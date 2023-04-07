import { retrieveAstFromRCode } from './r-bridge/parse'

console.log('Hello World')

void retrieveAstFromRCode('test/testfiles/example.R').then(xml => {
  console.log(xml)
})
