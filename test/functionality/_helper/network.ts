// based on https://stackoverflow.com/a/63756303
import * as dns from 'dns/promises';

/** check if this process has a network connection (yet, the network connection might be slow/blocked in other ways)*/
export const checkNetworkConnection = async(): Promise<boolean> => {
	const value = (await dns.resolve('google.com').catch(() => {
		/* do nothing */
	}));
	return typeof value === 'object' ? value.length > 0 : false;
};
