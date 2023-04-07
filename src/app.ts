import { retrieveAstFromRCode } from './r-bridge/parse'

console.log('Hello World')

void retrieveAstFromRCode({
  request: 'file',
  content: 'test/testfiles/example.R',
  attachSourceInformation: true
}).then(xml => {
  console.log(xml)
})
