import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { registerFaqs } from './data/faq/faqs';

function print(): string {
	const faqs = registerFaqs();
	return `${autoGenHeader({ filename: module.filename, purpose: 'frequently asked questions' })}
	
	${faqs.toMarkdown()}

    `.trim();
}


if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);
	console.log(print());
}
