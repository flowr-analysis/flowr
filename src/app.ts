import { retrieveXmlFromRCode } from './r-bridge/parse'

console.log('Hello World')

void retrieveXmlFromRCode('test/testfiles/example.R').then(xml => {
  console.log('got', xml)
})
