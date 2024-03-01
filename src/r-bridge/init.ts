import { ts2r } from './lang-4.x'

export const ErrorMarker = 'err'

/** Command(s) to be issued at the start of each shell */
export function initCommand(eol: string): string {
	/* define the get function complete wrapped in a try so that we can handle failures gracefully on stdout
	 * furthermore, we compile for performance reasons
	 */
	return 'flowr_get_ast<-compiler::cmpfun(function(...){tryCatch({'
		/* the actual code to parse the R code, ... allows us to keep the old 'file=path' and 'text=content' semantics. we define flowr_output using the super assignment to persist it in the env! */
		+ 's <- Sys.time();flowr_output<<-utils::getParseData(parse(...,keep.source=TRUE),includeText=TRUE);cat((Sys.time() - s)*1000,"\n",file="parse-log.txt",append=TRUE);'
		/* json conversion of the output, dataframe="values" allows us to receive a list of lists (which is more compact)!
		 * so we do not depend on jsonlite and friends, we do so manually (:sparkles:)
		 */
		+ 's <- Sys.time();apply(flowr_output,1,function(o)cat(sprintf("[%s,%s,%s,%s,%s,%s,%s,%s,%s],",o[[1]],o[[2]],o[[3]],o[[4]],o[[5]],o[[6]],deparse(o[[7]]),if(o[[8]])"true"else"false",deparse(o[[9]]))));'
		/* error handling (just produce the marker) */
		+ `cat((Sys.time() - s)*1000,"\n",file="out-log.txt",append=TRUE);},error=function(e){cat("${ErrorMarker}")});cat(${ts2r(eol)})});`
}
