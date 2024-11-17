_This document was generated from 'src/documentation/print-interface-wiki.ts' on 2024-11-14, 16:01:02 UTC presenting an overview of flowR's interfaces (v2.1.5, using R v4.4.0)._

Although far from being as detailed as the in-depth explanation of
[_flowR_](https://github.com/flowr-analysis/flowr/wiki//Core),
this wiki page explains how to interface with _flowR_ in more detail.
In general, command line arguments and other options provide short descriptions on hover over.

* [💬 Communicating with the Server](#communicating-with-the-server)
* [💻 Using the REPL](#using-the-repl)
* [⚙️ Configuring FlowR](#configuring-flowr)
* [⚒️ Writing Code](#writing-code)

<a id='communicating-with-the-server'></a>
## 💬 Communicating with the Server


As explained in the [Overview](https://github.com/flowr-analysis/flowr/wiki//Overview), you can simply run the [TCP](https://de.wikipedia.org/wiki/Transmission_Control_Protocol)&nbsp;server by adding the <span title="Description (Command Line Argument): Do not drop into a repl, but instead start a server on the given port (default: 1042) and listen for messages.">`--server`</span> flag (and, due to the interactive mode, exit with the conventional <kbd>CTRL</kbd>+<kbd>C</kbd>).
Currently, every connection is handled by the same underlying `RShell` - so the server is not designed to handle many clients at a time.
Additionally, the server is not well guarded against attacks (e.g., you can theoretically spawn an arbitrary number of&nbsp;RShell sessions on the target machine).

Every message has to be given in a single line (i.e., without a newline in-between) and end with a newline character. Nevertheless, we will pretty-print example given in the following segments for the ease of reading.


> [!NOTE]
> 
> The default <span title="Description (Command Line Argument): Do not drop into a repl, but instead start a server on the given port (default: 1042) and listen for messages.">`--server`</span> uses a simple [TCP](https://de.wikipedia.org/wiki/Transmission_Control_Protocol)
> connection. If you want _flowR_ to expose a [WebSocket](https://de.wikipedia.org/wiki/WebSocket) server instead, add the <span title="Description (Command Line Argument): If the server flag is set, use websocket for messaging">`--ws`</span> flag (i.e., <span title="Description (Command Line Argument): Do not drop into a repl, but instead start a server on the given port (default: 1042) and listen for messages.">`--server`</span> <span title="Description (Command Line Argument): If the server flag is set, use websocket for messaging">`--ws`</span>) when starting _flowR_ from the command line.
> 			


<ul><li>
<a id="message-hello"></a>
<b>Hello</b> Message (<code>hello</code>) 
<details>

<summary style="color:gray"> View Details. <i>The server informs the client about the successful connection and provides Meta-Information.</i> </summary>

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server

    
    Client-->Server: connects
    Server->>Client: hello
	
```


	
After launching _flowR_, for example, with <code>docker run -it --rm eagleoutice/flowr <span title="Description (Command Line Argument): Do not drop into a repl, but instead start a server on the given port (default: 1042) and listen for messages.">-<span/>-server</span></code>&nbsp;(🐳️), simply connecting should present you with a `hello` message, that amongst others should reveal the versions of&nbsp;_flowR_ and&nbsp;R, using the [semver 2.0](https://semver.org/spec/v2.0.0.html) versioning scheme.
The message looks like this:


```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```


There are currently a few messages that you can send after the hello message.
If you want to _slice_ a piece of R code you first have to send an [analysis request](#message-request-file-analysis), so that you can send one or multiple slice requests afterward.
Requests for the [REPL](#message-request-repl) are independent of that.
	

<hr>


<details>
<summary style="color:gray">Message schema (<code>hello</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-hello.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-hello.ts).

- **.** object [required]
    - **type** string [required]
        _The type of the hello message._
        Allows only the values: 'hello'
    - **id** any [forbidden]
        _The id of the message is always undefined (as it is the initial message and not requested)._
    - **clientName** string [required]
        _A unique name that is assigned to each client. It has no semantic meaning and is only used/useful for debugging._
    - **versions** object [required]
        - **flowr** string [required]
            _The version of the flowr server running in semver format._
        - **r** string [required]
            _The version of the underlying R shell running in semver format._

</details>



<hr>

</details>	
	</li>

<li>
<a id="message-request-file-analysis"></a>
<b>Analysis</b> Message (<code>request-file-analysis</code>) 
<details>

<summary style="color:gray"> View Details. <i>The server builds the dataflow graph for a given input file (or a set of files).</i> </summary>

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server

    
    Client->>+Server: request-file-analysis
    alt
        Server-->>Client: response-file-analysis
    else
        Server-->>Client: error
    end
    deactivate  Server
	
```


	
The request allows the server to analyze a file and prepare it for slicing.
The message can contain a `filetoken`, which is used to identify the file in later slice or lineage requests (if you do not add one, the request will not be stored and therefore, it is not available for subsequent requests).

> [!IMPORTANT]
> If you want to send and process a lot of analysis requests, but do not want to slice them, please do not pass the `filetoken` field. This will save the server a lot of memory allocation.

Furthermore, the request must contain either a `content` field to directly pass the file's content or a `filepath` field which contains the path to the file (this path must be accessible for the server to be useful).
If you add the `id` field, the answer will use the same `id` so you can match requests and the corresponding answers.
See the implementation of the request-file-analysis message for more information.


<details>
<summary>Example of the <code>request-file-analysis</code> Message</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

<ol>
<li> <code>hello</code> (response)
<details> 

<summary> Show Details </summary>

The first message is always a hello message.




```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```



</details>
</li>

<li> <b><code>request-file-analysis</code> (request)</b>
<details open> 

<summary> Show Details </summary>

Let' suppose you simply want to analyze the following script:
 
```r
x <- 1
x + 1
```

 For this, you can send the following request:




```json
{
  "type": "request-file-analysis",
  "id": "1",
  "filetoken": "x",
  "content": "x <- 1\nx + 1"
}
```



</details>
</li>

<li> <code>response-file-analysis</code> (response)
<details> 

<summary> Show Details </summary>



The `results` field of the response effectively contains three keys of importance:

- `parse`: which contains 1:1 the parse result in CSV format that we received from the `RShell` (i.e., the AST produced by the parser of the R interpreter).
- `normalize`: which contains the normalized AST, including ids (see the `info` field and the [Normalized AST](https://github.com/flowr-analysis/flowr/wiki//Normalized%20AST) wiki page).
- `dataflow`: especially important is the `graph` field which contains the dataflow graph as a set of root vertices (see the [Dataflow Graph](https://github.com/flowr-analysis/flowr/wiki//Dataflow%20Graph) wiki page).
			


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"type":"response-file-analysis","format":"json","id":"1","results":{"parse":{"parsed":"[1,1,1,6,7,0,\"expr\",false,\"x <- 1\"],[1,1,1,1,1,3,\"SYMBOL\",true,\"x\"],[1,1,1,1,3,7,\"expr\",false,\"x\"],[1,3,1,4,2,7,\"LEFT_ASSIGN\",true,\"<-\"],[1,6,1,6,4,5,\"NUM_CONST\",true,\"1\"],[1,6,1,6,5,7,\"expr\",false,\"1\"],[2,1,2,5,16,0,\"expr\",false,\"x + 1\"],[2,1,2,1,10,12,\"SYMBOL\",true,\"x\"],[2,1,2,1,12,16,\"expr\",false,\"x\"],[2,3,2,3,11,16,\"'+'\",true,\"+\"],[2,5,2,5,13,14,\"NUM_CONST\",true,\"1\"],[2,5,2,5,14,16,\"expr\",false,\"1\"]",".meta":{"timing":4}},"normalize":{"ast":{"type":"RExpressionList","children":[{"type":"RBinaryOp","location":[1,3,1,4],"lhs":{"type":"RSymbol","location":[1,1,1,1],"content":"x","lexeme":"x","info":{"fullRange":[1,1,1,1],"additionalTokens":[],"id":0,"parent":2,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-UXu5HaVZxZ2T-.R"}},"rhs":{"location":[1,6,1,6],"lexeme":"1","info":{"fullRange":[1,6,1,6],"additionalTokens":[],"id":1,"parent":2,"role":"binop-rhs","index":1,"nesting":0,"file":"/tmp/tmp-5406-UXu5HaVZxZ2T-.R"},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"operator":"<-","lexeme":"<-","info":{"fullRange":[1,1,1,6],"additionalTokens":[],"id":2,"parent":6,"nesting":0,"file":"/tmp/tmp-5406-UXu5HaVZxZ2T-.R","index":0,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[2,3,2,3],"lhs":{"type":"RSymbol","location":[2,1,2,1],"content":"x","lexeme":"x","info":{"fullRange":[2,1,2,1],"additionalTokens":[],"id":3,"parent":5,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-UXu5HaVZxZ2T-.R"}},"rhs":{"location":[2,5,2,5],"lexeme":"1","info":{"fullRange":[2,5,2,5],"additionalTokens":[],"id":4,"parent":5,"role":"binop-rhs","index":1,"nesting":0,"file":"/tmp/tmp-5406-UXu5HaVZxZ2T-.R"},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"operator":"+","lexeme":"+","info":{"fullRange":[2,1,2,5],"additionalTokens":[],"id":5,"parent":6,"nesting":0,"file":"/tmp/tmp-5406-UXu5HaVZxZ2T-.R","index":1,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":6,"nesting":0,"file":"/tmp/tmp-5406-UXu5HaVZxZ2T-.R","role":"root","index":0}},".meta":{"timing":3}},"dataflow":{"unknownReferences":[],"in":[{"nodeId":2,"name":"<-","type":2},{"nodeId":5,"name":"+","type":2}],"out":[{"nodeId":0,"name":"x","type":4,"definedAt":2}],"environment":{"current":{"id":12,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["x",[{"nodeId":0,"name":"x","type":4,"definedAt":2}]]]},"level":0},"graph":{"_unknownSideEffects":[],"rootVertices":[1,0,2,3,4,5],"vertexInformation":[[1,{"tag":"value","id":1}],[0,{"tag":"variable-definition","id":0}],[2,{"tag":"function-call","id":2,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":0,"type":32},{"nodeId":1,"type":32}]}],[3,{"tag":"use","id":3}],[4,{"tag":"value","id":4}],[5,{"tag":"function-call","id":5,"name":"+","onlyBuiltin":true,"args":[{"nodeId":3,"type":32},{"nodeId":4,"type":32}]}]],"edgeInformation":[[2,[[1,{"types":64}],[0,{"types":72}]]],[0,[[1,{"types":2}],[2,{"types":2}]]],[3,[[0,{"types":1}]]],[5,[[3,{"types":65}],[4,{"types":65}]]]]},"entryPoint":2,"exitPoints":[{"type":0,"nodeId":5}],".meta":{"timing":4}}}}
```



</details>
</li>
</ol>

The complete round-trip took 15.48 ms (including time required to validate the messages, start, and stop the internal mock server).

</details>


You receive an error if, for whatever reason, the analysis fails (e.g., the message or code you sent contained syntax errors).
It contains a human-readable description *why* the analysis failed (see the error message implementation for more details).


<details>
<summary>Example Error Message</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

<ol>
<li> <code>hello</code> (response)
<details> 

<summary> Show Details </summary>

The first message is always a hello message.




```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```



</details>
</li>

<li> <code>request-file-analysis</code> (request)
<details> 

<summary> Show Details </summary>






```json
{
  "type": "request-file-analysis",
  "id": "1",
  "filename": "sample.R",
  "content": "x <-"
}
```



</details>
</li>

<li> <b><code>error</code> (response)</b>
<details open> 

<summary> Show Details </summary>






```json
{
  "id": "1",
  "type": "error",
  "fatal": false,
  "reason": "Error while analyzing file sample.R: GuardError: unable to parse R code (see the log for more information) for request {\"request\":\"file\",\"content\":\"/tmp/tmp-5406-4Uqda7QPGMIS-.R\"}}"
}
```



</details>
</li>
</ol>

The complete round-trip took 1.75 ms (including time required to validate the messages, start, and stop the internal mock server).

</details>


&nbsp;

<a id="analysis-include-cfg"></a>
**Including the Control Flow Graph**

While _flowR_ does (for the time being) not use an explicit control flow graph but instead relies on control-dependency edges within the dataflow graph, 
the respective structure can still be exposed using the server (note that, as this feature is not needed within _flowR_, it is tested significantly less - 
so please create a [new issue](https://github.com/flowr-analysis/flowr/issues/new/choose) for any bug you may encounter).
For this, the analysis request may add `cfg: true` to its list of options.


<details>
<summary>Requesting a Control Flow Graph</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

<ol>
<li> <code>hello</code> (response)
<details> 

<summary> Show Details </summary>

The first message is always a hello message.




```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```



</details>
</li>

<li> <b><code>request-file-analysis</code> (request)</b>
<details open> 

<summary> Show Details </summary>






```json
{
  "type": "request-file-analysis",
  "id": "1",
  "filetoken": "x",
  "content": "if(unknown > 0) { x <- 2 } else { x <- 5 }\nfor(i in 1:x) { print(x); print(i) }",
  "cfg": true
}
```



</details>
</li>

<li> <code>response-file-analysis</code> (response)
<details> 

<summary> Show Details </summary>


The response looks basically the same as a response sent without the `cfg` flag. However, additionally it contains a `cfg` field. 
If you are interested in a visual representation of the control flow graph, see the 
[visualization with mermaid](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgbjE1W1wiYFJJZlRoZW5FbHNlICgxNSlcbiMzNDtpZih1bmtub3duICM2MjsgMCkgIzEyMzsgeCAjNjA7IzQ1OyAyICMxMjU7IGVsc2UgIzEyMzsgeCAjNjA7IzQ1OyA1ICMxMjU7IzM0O2BcIl1cbiAgICBuMTUtZXhpdCgoICkpXG4gICAgbjBbXCJgUlN5bWJvbCAoMClcbiMzNDt1bmtub3duIzM0O2BcIl1cbiAgICBuMVtcImBSTnVtYmVyICgxKVxuIzM0OzAjMzQ7YFwiXVxuICAgIG4yW1wiYFJCaW5hcnlPcCAoMilcbiMzNDt1bmtub3duICM2MjsgMCMzNDtgXCJdXG4gICAgbjItZXhpdCgoICkpXG4gICAgbjVbXCJgUlN5bWJvbCAoNSlcbiMzNDt4IzM0O2BcIl1cbiAgICBuNltcImBSTnVtYmVyICg2KVxuIzM0OzIjMzQ7YFwiXVxuICAgIG43W1wiYFJCaW5hcnlPcCAoNylcbiMzNDt4ICM2MDsjNDU7IDIjMzQ7YFwiXVxuICAgIG43LWV4aXQoKCApKVxuICAgIG4xMVtcImBSU3ltYm9sICgxMSlcbiMzNDt4IzM0O2BcIl1cbiAgICBuMTJbXCJgUk51bWJlciAoMTIpXG4jMzQ7NSMzNDtgXCJdXG4gICAgbjEzW1wiYFJCaW5hcnlPcCAoMTMpXG4jMzQ7eCAjNjA7IzQ1OyA1IzM0O2BcIl1cbiAgICBuMTMtZXhpdCgoICkpXG4gICAgbjE2W1wiYFJTeW1ib2wgKDE2KVxuIzM0O2kjMzQ7YFwiXVxuICAgIG4zMVtcImBSRm9yTG9vcCAoMzEpXG4jMzQ7Zm9yKGkgaW4gMSM1ODt4KSAjMTIzOyBwcmludCh4KTsgcHJpbnQoaSkgIzEyNTsjMzQ7YFwiXVxuICAgIG4zMS1leGl0KCggKSlcbiAgICBuMTdbXCJgUk51bWJlciAoMTcpXG4jMzQ7MSMzNDtgXCJdXG4gICAgbjE4W1wiYFJTeW1ib2wgKDE4KVxuIzM0O3gjMzQ7YFwiXVxuICAgIG4xOVtcImBSQmluYXJ5T3AgKDE5KVxuIzM0OzEjNTg7eCMzNDtgXCJdXG4gICAgbjE5LWV4aXQoKCApKVxuICAgIG4yMltcImBSU3ltYm9sICgyMilcbiMzNDtwcmludCh4KSMzNDtgXCJdXG4gICAgbjI1W1wiYFJGdW5jdGlvbkNhbGwgKDI1KVxuIzM0O3ByaW50KHgpIzM0O2BcIl1cbiAgICBuMjUtbmFtZSgoICkpXG4gICAgbjI1LWV4aXQoKCApKVxuICAgIG4yNFtcImBSQXJndW1lbnQgKDI0KVxuIzM0O3gjMzQ7YFwiXVxuICAgIG4yNC1iZWZvcmUtdmFsdWUoKCApKVxuICAgIG4yM1tcImBSU3ltYm9sICgyMylcbiMzNDt4IzM0O2BcIl1cbiAgICBuMjQtZXhpdCgoICkpXG4gICAgbjI2W1wiYFJTeW1ib2wgKDI2KVxuIzM0O3ByaW50KGkpIzM0O2BcIl1cbiAgICBuMjlbXCJgUkZ1bmN0aW9uQ2FsbCAoMjkpXG4jMzQ7cHJpbnQoaSkjMzQ7YFwiXVxuICAgIG4yOS1uYW1lKCggKSlcbiAgICBuMjktZXhpdCgoICkpXG4gICAgbjI4W1wiYFJBcmd1bWVudCAoMjgpXG4jMzQ7aSMzNDtgXCJdXG4gICAgbjI4LWJlZm9yZS12YWx1ZSgoICkpXG4gICAgbjI3W1wiYFJTeW1ib2wgKDI3KVxuIzM0O2kjMzQ7YFwiXVxuICAgIG4yOC1leGl0KCggKSlcbiAgICBuMSAtLi0+fFwiRkRcInwgbjBcbiAgICBuMCAtLi0+fFwiRkRcInwgbjJcbiAgICBuMi1leGl0IC0uLT58XCJGRFwifCBuMVxuICAgIG42IC0uLT58XCJGRFwifCBuNVxuICAgIG41IC0uLT58XCJGRFwifCBuN1xuICAgIG43LWV4aXQgLS4tPnxcIkZEXCJ8IG42XG4gICAgbjEyIC0uLT58XCJGRFwifCBuMTFcbiAgICBuMTEgLS4tPnxcIkZEXCJ8IG4xM1xuICAgIG4xMy1leGl0IC0uLT58XCJGRFwifCBuMTJcbiAgICBuNyAtLT58XCJDRCAoVFJVRSlcInwgbjItZXhpdFxuICAgIG4xMyAtLT58XCJDRCAoRkFMU0UpXCJ8IG4yLWV4aXRcbiAgICBuMiAtLi0+fFwiRkRcInwgbjE1XG4gICAgbjE1LWV4aXQgLS4tPnxcIkZEXCJ8IG43LWV4aXRcbiAgICBuMTUtZXhpdCAtLi0+fFwiRkRcInwgbjEzLWV4aXRcbiAgICBuMzEgLS4tPnxcIkZEXCJ8IG4xNS1leGl0XG4gICAgbjMxIC0uLT58XCJGRFwifCBuMjktZXhpdFxuICAgIG4xOCAtLi0+fFwiRkRcInwgbjE3XG4gICAgbjE3IC0uLT58XCJGRFwifCBuMTlcbiAgICBuMTktZXhpdCAtLi0+fFwiRkRcInwgbjE4XG4gICAgbjIyIC0uLT58XCJGRFwifCBuMjVcbiAgICBuMjUtbmFtZSAtLi0+fFwiRkRcInwgbjIyXG4gICAgbjI0LWJlZm9yZS12YWx1ZSAtLi0+fFwiRkRcInwgbjI0XG4gICAgbjIzIC0uLT58XCJGRFwifCBuMjQtYmVmb3JlLXZhbHVlXG4gICAgbjI0LWV4aXQgLS4tPnxcIkZEXCJ8IG4yM1xuICAgIG4yNCAtLi0+fFwiRkRcInwgbjI1LW5hbWVcbiAgICBuMjUtZXhpdCAtLi0+fFwiRkRcInwgbjI0LWV4aXRcbiAgICBuMjkgLS4tPnxcIkZEXCJ8IG4yNS1leGl0XG4gICAgbjI2IC0uLT58XCJGRFwifCBuMjlcbiAgICBuMjktbmFtZSAtLi0+fFwiRkRcInwgbjI2XG4gICAgbjI4LWJlZm9yZS12YWx1ZSAtLi0+fFwiRkRcInwgbjI4XG4gICAgbjI3IC0uLT58XCJGRFwifCBuMjgtYmVmb3JlLXZhbHVlXG4gICAgbjI4LWV4aXQgLS4tPnxcIkZEXCJ8IG4yN1xuICAgIG4yOCAtLi0+fFwiRkRcInwgbjI5LW5hbWVcbiAgICBuMjktZXhpdCAtLi0+fFwiRkRcInwgbjI4LWV4aXRcbiAgICBuMTkgLS4tPnxcIkZEXCJ8IG4zMVxuICAgIG4xNiAtLi0+fFwiRkRcInwgbjE5LWV4aXRcbiAgICBuMjUgLS0+fFwiQ0QgKFRSVUUpXCJ8IG4xNlxuICAgIG4zMS1leGl0IC0tPnxcIkNEIChGQUxTRSlcInwgbjE2XG4gICAgc3R5bGUgbjE1IHN0cm9rZTpjeWFuLHN0cm9rZS13aWR0aDo2LjVweDsgICAgc3R5bGUgbjMxLWV4aXQgc3Ryb2tlOmdyZWVuLHN0cm9rZS13aWR0aDo2LjVweDsiLCJtZXJtYWlkIjp7ImF1dG9TeW5jIjp0cnVlfX0=).
			


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"type":"response-file-analysis","format":"json","id":"1","cfg":{"graph":{"rootVertices":[15,"15-exit",0,1,2,"2-exit",5,6,7,"7-exit",11,12,13,"13-exit",16,31,"31-exit",17,18,19,"19-exit",22,25,"25-name","25-exit",24,"24-before-value",23,"24-exit",26,29,"29-name","29-exit",28,"28-before-value",27,"28-exit"],"vertexInformation":[[15,{"id":15,"name":"RIfThenElse","type":"statement"}],["15-exit",{"id":"15-exit","name":"if-exit","type":"end-marker"}],[0,{"id":0,"name":"RSymbol","type":"expression"}],[1,{"id":1,"name":"RNumber","type":"expression"}],[2,{"id":2,"name":"RBinaryOp","type":"expression"}],["2-exit",{"id":"2-exit","name":"binOp-exit","type":"end-marker"}],[5,{"id":5,"name":"RSymbol","type":"expression"}],[6,{"id":6,"name":"RNumber","type":"expression"}],[7,{"id":7,"name":"RBinaryOp","type":"expression"}],["7-exit",{"id":"7-exit","name":"binOp-exit","type":"end-marker"}],[11,{"id":11,"name":"RSymbol","type":"expression"}],[12,{"id":12,"name":"RNumber","type":"expression"}],[13,{"id":13,"name":"RBinaryOp","type":"expression"}],["13-exit",{"id":"13-exit","name":"binOp-exit","type":"end-marker"}],[16,{"id":16,"name":"RSymbol","type":"expression"}],[31,{"id":31,"name":"RForLoop","type":"statement"}],["31-exit",{"id":"31-exit","name":"for-exit","type":"end-marker"}],[17,{"id":17,"name":"RNumber","type":"expression"}],[18,{"id":18,"name":"RSymbol","type":"expression"}],[19,{"id":19,"name":"RBinaryOp","type":"expression"}],["19-exit",{"id":"19-exit","name":"binOp-exit","type":"end-marker"}],[22,{"id":22,"name":"RSymbol","type":"expression"}],[25,{"id":25,"name":"RFunctionCall","type":"statement"}],["25-name",{"id":"25-name","name":"call-name","type":"mid-marker"}],["25-exit",{"id":"25-exit","name":"call-exit","type":"end-marker"}],[24,{"id":24,"name":"RArgument","type":"expression"}],["24-before-value",{"id":"24-before-value","name":"before-value","type":"mid-marker"}],[23,{"id":23,"name":"RSymbol","type":"expression"}],["24-exit",{"id":"24-exit","name":"exit","type":"end-marker"}],[26,{"id":26,"name":"RSymbol","type":"expression"}],[29,{"id":29,"name":"RFunctionCall","type":"statement"}],["29-name",{"id":"29-name","name":"call-name","type":"mid-marker"}],["29-exit",{"id":"29-exit","name":"call-exit","type":"end-marker"}],[28,{"id":28,"name":"RArgument","type":"expression"}],["28-before-value",{"id":"28-before-value","name":"before-value","type":"mid-marker"}],[27,{"id":27,"name":"RSymbol","type":"expression"}],["28-exit",{"id":"28-exit","name":"exit","type":"end-marker"}]],"edgeInformation":[[1,[[0,{"label":"FD"}]]],[0,[[2,{"label":"FD"}]]],["2-exit",[[1,{"label":"FD"}]]],[6,[[5,{"label":"FD"}]]],[5,[[7,{"label":"FD"}]]],["7-exit",[[6,{"label":"FD"}]]],[12,[[11,{"label":"FD"}]]],[11,[[13,{"label":"FD"}]]],["13-exit",[[12,{"label":"FD"}]]],[7,[["2-exit",{"label":"CD","when":"TRUE"}]]],[13,[["2-exit",{"label":"CD","when":"FALSE"}]]],[2,[[15,{"label":"FD"}]]],["15-exit",[["7-exit",{"label":"FD"}],["13-exit",{"label":"FD"}]]],[31,[["15-exit",{"label":"FD"}],["29-exit",{"label":"FD"}]]],[18,[[17,{"label":"FD"}]]],[17,[[19,{"label":"FD"}]]],["19-exit",[[18,{"label":"FD"}]]],[22,[[25,{"label":"FD"}]]],["25-name",[[22,{"label":"FD"}]]],["24-before-value",[[24,{"label":"FD"}]]],[23,[["24-before-value",{"label":"FD"}]]],["24-exit",[[23,{"label":"FD"}]]],[24,[["25-name",{"label":"FD"}]]],["25-exit",[["24-exit",{"label":"FD"}]]],[29,[["25-exit",{"label":"FD"}]]],[26,[[29,{"label":"FD"}]]],["29-name",[[26,{"label":"FD"}]]],["28-before-value",[[28,{"label":"FD"}]]],[27,[["28-before-value",{"label":"FD"}]]],["28-exit",[[27,{"label":"FD"}]]],[28,[["29-name",{"label":"FD"}]]],["29-exit",[["28-exit",{"label":"FD"}]]],[19,[[31,{"label":"FD"}]]],[16,[["19-exit",{"label":"FD"}]]],[25,[[16,{"label":"CD","when":"TRUE"}]]],["31-exit",[[16,{"label":"CD","when":"FALSE"}]]]]},"breaks":[],"nexts":[],"returns":[],"exitPoints":["31-exit"],"entryPoints":[15]},"results":{"parse":{"parsed":"[1,1,1,42,38,0,\"expr\",false,\"if(unknown > 0) { x <- 2 } else { x <- 5 }\"],[1,1,1,2,1,38,\"IF\",true,\"if\"],[1,3,1,3,2,38,\"'('\",true,\"(\"],[1,4,1,14,9,38,\"expr\",false,\"unknown > 0\"],[1,4,1,10,3,5,\"SYMBOL\",true,\"unknown\"],[1,4,1,10,5,9,\"expr\",false,\"unknown\"],[1,12,1,12,4,9,\"GT\",true,\">\"],[1,14,1,14,6,7,\"NUM_CONST\",true,\"0\"],[1,14,1,14,7,9,\"expr\",false,\"0\"],[1,15,1,15,8,38,\"')'\",true,\")\"],[1,17,1,26,22,38,\"expr\",false,\"{ x <- 2 }\"],[1,17,1,17,12,22,\"'{'\",true,\"{\"],[1,19,1,24,19,22,\"expr\",false,\"x <- 2\"],[1,19,1,19,13,15,\"SYMBOL\",true,\"x\"],[1,19,1,19,15,19,\"expr\",false,\"x\"],[1,21,1,22,14,19,\"LEFT_ASSIGN\",true,\"<-\"],[1,24,1,24,16,17,\"NUM_CONST\",true,\"2\"],[1,24,1,24,17,19,\"expr\",false,\"2\"],[1,26,1,26,18,22,\"'}'\",true,\"}\"],[1,28,1,31,23,38,\"ELSE\",true,\"else\"],[1,33,1,42,35,38,\"expr\",false,\"{ x <- 5 }\"],[1,33,1,33,25,35,\"'{'\",true,\"{\"],[1,35,1,40,32,35,\"expr\",false,\"x <- 5\"],[1,35,1,35,26,28,\"SYMBOL\",true,\"x\"],[1,35,1,35,28,32,\"expr\",false,\"x\"],[1,37,1,38,27,32,\"LEFT_ASSIGN\",true,\"<-\"],[1,40,1,40,29,30,\"NUM_CONST\",true,\"5\"],[1,40,1,40,30,32,\"expr\",false,\"5\"],[1,42,1,42,31,35,\"'}'\",true,\"}\"],[2,1,2,36,84,0,\"expr\",false,\"for(i in 1:x) { print(x); print(i) }\"],[2,1,2,3,41,84,\"FOR\",true,\"for\"],[2,4,2,13,53,84,\"forcond\",false,\"(i in 1:x)\"],[2,4,2,4,42,53,\"'('\",true,\"(\"],[2,5,2,5,43,53,\"SYMBOL\",true,\"i\"],[2,7,2,8,44,53,\"IN\",true,\"in\"],[2,10,2,12,51,53,\"expr\",false,\"1:x\"],[2,10,2,10,45,46,\"NUM_CONST\",true,\"1\"],[2,10,2,10,46,51,\"expr\",false,\"1\"],[2,11,2,11,47,51,\"':'\",true,\":\"],[2,12,2,12,48,50,\"SYMBOL\",true,\"x\"],[2,12,2,12,50,51,\"expr\",false,\"x\"],[2,13,2,13,49,53,\"')'\",true,\")\"],[2,15,2,36,81,84,\"expr\",false,\"{ print(x); print(i) }\"],[2,15,2,15,54,81,\"'{'\",true,\"{\"],[2,17,2,24,64,81,\"expr\",false,\"print(x)\"],[2,17,2,21,55,57,\"SYMBOL_FUNCTION_CALL\",true,\"print\"],[2,17,2,21,57,64,\"expr\",false,\"print\"],[2,22,2,22,56,64,\"'('\",true,\"(\"],[2,23,2,23,58,60,\"SYMBOL\",true,\"x\"],[2,23,2,23,60,64,\"expr\",false,\"x\"],[2,24,2,24,59,64,\"')'\",true,\")\"],[2,25,2,25,65,81,\"';'\",true,\";\"],[2,27,2,34,77,81,\"expr\",false,\"print(i)\"],[2,27,2,31,68,70,\"SYMBOL_FUNCTION_CALL\",true,\"print\"],[2,27,2,31,70,77,\"expr\",false,\"print\"],[2,32,2,32,69,77,\"'('\",true,\"(\"],[2,33,2,33,71,73,\"SYMBOL\",true,\"i\"],[2,33,2,33,73,77,\"expr\",false,\"i\"],[2,34,2,34,72,77,\"')'\",true,\")\"],[2,36,2,36,78,81,\"'}'\",true,\"}\"]",".meta":{"timing":3}},"normalize":{"ast":{"type":"RExpressionList","children":[{"type":"RIfThenElse","condition":{"type":"RBinaryOp","location":[1,12,1,12],"lhs":{"type":"RSymbol","location":[1,4,1,10],"content":"unknown","lexeme":"unknown","info":{"fullRange":[1,4,1,10],"additionalTokens":[],"id":0,"parent":2,"role":"binop-lhs","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"rhs":{"location":[1,14,1,14],"lexeme":"0","info":{"fullRange":[1,14,1,14],"additionalTokens":[],"id":1,"parent":2,"role":"binop-rhs","index":1,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"},"type":"RNumber","content":{"num":0,"complexNumber":false,"markedAsInt":false}},"operator":">","lexeme":">","info":{"fullRange":[1,4,1,14],"additionalTokens":[],"id":2,"parent":15,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","role":"if-cond"}},"then":{"type":"RExpressionList","children":[{"type":"RBinaryOp","location":[1,21,1,22],"lhs":{"type":"RSymbol","location":[1,19,1,19],"content":"x","lexeme":"x","info":{"fullRange":[1,19,1,19],"additionalTokens":[],"id":5,"parent":7,"role":"binop-lhs","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"rhs":{"location":[1,24,1,24],"lexeme":"2","info":{"fullRange":[1,24,1,24],"additionalTokens":[],"id":6,"parent":7,"role":"binop-rhs","index":1,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"},"type":"RNumber","content":{"num":2,"complexNumber":false,"markedAsInt":false}},"operator":"<-","lexeme":"<-","info":{"fullRange":[1,19,1,24],"additionalTokens":[],"id":7,"parent":8,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":0,"role":"expr-list-child"}}],"grouping":[{"type":"RSymbol","location":[1,17,1,17],"content":"{","lexeme":"{","info":{"fullRange":[1,17,1,26],"additionalTokens":[],"id":3,"role":"root","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},{"type":"RSymbol","location":[1,26,1,26],"content":"}","lexeme":"}","info":{"fullRange":[1,17,1,26],"additionalTokens":[],"id":4,"role":"root","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}}],"info":{"additionalTokens":[],"id":8,"parent":15,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":1,"role":"if-then"}},"location":[1,1,1,2],"lexeme":"if","info":{"fullRange":[1,1,1,42],"additionalTokens":[],"id":15,"parent":32,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":0,"role":"expr-list-child"},"otherwise":{"type":"RExpressionList","children":[{"type":"RBinaryOp","location":[1,37,1,38],"lhs":{"type":"RSymbol","location":[1,35,1,35],"content":"x","lexeme":"x","info":{"fullRange":[1,35,1,35],"additionalTokens":[],"id":11,"parent":13,"role":"binop-lhs","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"rhs":{"location":[1,40,1,40],"lexeme":"5","info":{"fullRange":[1,40,1,40],"additionalTokens":[],"id":12,"parent":13,"role":"binop-rhs","index":1,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"},"type":"RNumber","content":{"num":5,"complexNumber":false,"markedAsInt":false}},"operator":"<-","lexeme":"<-","info":{"fullRange":[1,35,1,40],"additionalTokens":[],"id":13,"parent":14,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":0,"role":"expr-list-child"}}],"grouping":[{"type":"RSymbol","location":[1,33,1,33],"content":"{","lexeme":"{","info":{"fullRange":[1,33,1,42],"additionalTokens":[],"id":9,"role":"root","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},{"type":"RSymbol","location":[1,42,1,42],"content":"}","lexeme":"}","info":{"fullRange":[1,33,1,42],"additionalTokens":[],"id":10,"role":"root","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}}],"info":{"additionalTokens":[],"id":14,"parent":15,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":2,"role":"if-otherwise"}}},{"type":"RForLoop","variable":{"type":"RSymbol","location":[2,5,2,5],"content":"i","lexeme":"i","info":{"additionalTokens":[],"id":16,"parent":31,"role":"for-variable","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"vector":{"type":"RBinaryOp","location":[2,11,2,11],"lhs":{"location":[2,10,2,10],"lexeme":"1","info":{"fullRange":[2,10,2,10],"additionalTokens":[],"id":17,"parent":19,"role":"binop-lhs","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"rhs":{"type":"RSymbol","location":[2,12,2,12],"content":"x","lexeme":"x","info":{"fullRange":[2,12,2,12],"additionalTokens":[],"id":18,"parent":19,"role":"binop-rhs","index":1,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"operator":":","lexeme":":","info":{"fullRange":[2,10,2,12],"additionalTokens":[],"id":19,"parent":31,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":1,"role":"for-vector"}},"body":{"type":"RExpressionList","children":[{"type":"RFunctionCall","named":true,"location":[2,17,2,21],"lexeme":"print","functionName":{"type":"RSymbol","location":[2,17,2,21],"content":"print","lexeme":"print","info":{"fullRange":[2,17,2,24],"additionalTokens":[],"id":22,"parent":25,"role":"call-name","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"arguments":[{"type":"RArgument","location":[2,23,2,23],"lexeme":"x","value":{"type":"RSymbol","location":[2,23,2,23],"content":"x","lexeme":"x","info":{"fullRange":[2,23,2,23],"additionalTokens":[],"id":23,"parent":24,"role":"arg-value","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"info":{"fullRange":[2,23,2,23],"additionalTokens":[],"id":24,"parent":25,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[2,17,2,24],"additionalTokens":[],"id":25,"parent":30,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":0,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[2,27,2,31],"lexeme":"print","functionName":{"type":"RSymbol","location":[2,27,2,31],"content":"print","lexeme":"print","info":{"fullRange":[2,27,2,34],"additionalTokens":[],"id":26,"parent":29,"role":"call-name","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"arguments":[{"type":"RArgument","location":[2,33,2,33],"lexeme":"i","value":{"type":"RSymbol","location":[2,33,2,33],"content":"i","lexeme":"i","info":{"fullRange":[2,33,2,33],"additionalTokens":[],"id":27,"parent":28,"role":"arg-value","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},"info":{"fullRange":[2,33,2,33],"additionalTokens":[],"id":28,"parent":29,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[2,27,2,34],"additionalTokens":[],"id":29,"parent":30,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":1,"role":"expr-list-child"}}],"grouping":[{"type":"RSymbol","location":[2,15,2,15],"content":"{","lexeme":"{","info":{"fullRange":[2,15,2,36],"additionalTokens":[],"id":20,"role":"root","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}},{"type":"RSymbol","location":[2,36,2,36],"content":"}","lexeme":"}","info":{"fullRange":[2,15,2,36],"additionalTokens":[],"id":21,"role":"root","index":0,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R"}}],"info":{"additionalTokens":[],"id":30,"parent":31,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":2,"role":"for-body"}},"lexeme":"for","info":{"fullRange":[2,1,2,36],"additionalTokens":[],"id":31,"parent":32,"nesting":1,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","index":1,"role":"expr-list-child"},"location":[2,1,2,3]}],"info":{"additionalTokens":[],"id":32,"nesting":0,"file":"/tmp/tmp-5406-dmHApoo8EZ3J-.R","role":"root","index":0}},".meta":{"timing":0}},"dataflow":{"unknownReferences":[],"in":[{"nodeId":15,"name":"if","type":2},{"nodeId":0,"name":"unknown","type":1},{"nodeId":2,"name":">","type":2},{"nodeId":7,"name":"<-","controlDependencies":[{"id":15,"when":true}],"type":2},{"nodeId":13,"name":"<-","controlDependencies":[{"id":15,"when":false}],"type":2},{"nodeId":8,"name":"{","controlDependencies":[{"id":15,"when":true}],"type":2},{"nodeId":14,"name":"{","controlDependencies":[{"id":15,"when":false}],"type":2},{"nodeId":31,"name":"for","type":2},{"name":":","nodeId":19,"type":2}],"out":[{"nodeId":5,"name":"x","controlDependencies":[{"id":15,"when":true},{"id":15,"when":true}],"type":4,"definedAt":7},{"nodeId":11,"name":"x","controlDependencies":[{"id":15,"when":false},{"id":15,"when":false}],"type":4,"definedAt":13},{"nodeId":16,"name":"i","type":1}],"environment":{"current":{"id":53,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["x",[{"nodeId":5,"name":"x","controlDependencies":[{"id":15,"when":false}],"type":4,"definedAt":7},{"nodeId":11,"name":"x","controlDependencies":[{"id":15,"when":false}],"type":4,"definedAt":13}]],["i",[{"nodeId":16,"name":"i","type":4,"definedAt":31}]]]},"level":0},"graph":{"_unknownSideEffects":[{"id":25,"linkTo":{"type":"link-to-last-call","callName":{}}},{"id":29,"linkTo":{"type":"link-to-last-call","callName":{}}}],"rootVertices":[0,1,2,6,5,7,8,12,11,13,14,15,16,17,18,19,23,25,27,29,30,31],"vertexInformation":[[0,{"tag":"use","id":0}],[1,{"tag":"value","id":1}],[2,{"tag":"function-call","id":2,"name":">","onlyBuiltin":true,"args":[{"nodeId":0,"type":32},{"nodeId":1,"type":32}]}],[6,{"tag":"value","id":6}],[5,{"tag":"variable-definition","id":5,"controlDependencies":[{"id":15,"when":true}]}],[7,{"tag":"function-call","id":7,"name":"<-","onlyBuiltin":true,"controlDependencies":[{"id":15,"when":true}],"args":[{"nodeId":5,"type":32},{"nodeId":6,"type":32}]}],[8,{"tag":"function-call","id":8,"name":"{","onlyBuiltin":true,"controlDependencies":[{"id":15,"when":true}],"args":[{"nodeId":7,"type":32}]}],[12,{"tag":"value","id":12}],[11,{"tag":"variable-definition","id":11,"controlDependencies":[{"id":15,"when":false}]}],[13,{"tag":"function-call","id":13,"name":"<-","onlyBuiltin":true,"controlDependencies":[{"id":15,"when":false}],"args":[{"nodeId":11,"type":32},{"nodeId":12,"type":32}]}],[14,{"tag":"function-call","id":14,"name":"{","onlyBuiltin":true,"controlDependencies":[{"id":15,"when":false}],"args":[{"nodeId":13,"type":32}]}],[15,{"tag":"function-call","id":15,"name":"if","onlyBuiltin":true,"args":[{"nodeId":2,"type":32},{"nodeId":8,"type":32},{"nodeId":14,"type":32}]}],[16,{"tag":"variable-definition","id":16}],[17,{"tag":"value","id":17}],[18,{"tag":"use","id":18}],[19,{"tag":"function-call","id":19,"name":":","onlyBuiltin":true,"args":[{"nodeId":17,"type":32},{"nodeId":18,"type":32}]}],[23,{"tag":"use","id":23,"controlDependencies":[{"id":31,"when":true}]}],[25,{"tag":"function-call","id":25,"name":"print","onlyBuiltin":true,"controlDependencies":[{"id":31,"when":true}],"args":[{"nodeId":23,"type":32}]}],[27,{"tag":"use","id":27,"controlDependencies":[{"id":31,"when":true}]}],[29,{"tag":"function-call","id":29,"name":"print","onlyBuiltin":true,"controlDependencies":[{"id":31,"when":true}],"args":[{"nodeId":27,"type":32}]}],[30,{"tag":"function-call","id":30,"name":"{","onlyBuiltin":true,"controlDependencies":[{"id":31,"when":true}],"args":[{"nodeId":25,"type":32},{"nodeId":29,"type":32}]}],[31,{"tag":"function-call","id":31,"name":"for","onlyBuiltin":true,"args":[{"nodeId":16,"type":32},{"nodeId":19,"type":32},{"nodeId":30,"type":32}]}]],"edgeInformation":[[2,[[0,{"types":65}],[1,{"types":65}]]],[7,[[6,{"types":64}],[5,{"types":72}]]],[5,[[6,{"types":2}],[7,{"types":2}]]],[8,[[7,{"types":72}]]],[15,[[8,{"types":72}],[14,{"types":72}],[2,{"types":65}]]],[13,[[12,{"types":64}],[11,{"types":72}]]],[11,[[12,{"types":2}],[13,{"types":2}]]],[14,[[13,{"types":72}]]],[19,[[17,{"types":65}],[18,{"types":65}]]],[18,[[5,{"types":1}],[11,{"types":1}]]],[23,[[5,{"types":1}],[11,{"types":1}]]],[25,[[23,{"types":73}]]],[27,[[16,{"types":1}]]],[29,[[27,{"types":73}]]],[30,[[25,{"types":64}],[29,{"types":72}]]],[16,[[19,{"types":2}]]],[31,[[16,{"types":65}],[19,{"types":65}],[30,{"types":320}]]]]},"entryPoint":15,"exitPoints":[{"type":0,"nodeId":31}],".meta":{"timing":5}}}}
```



</details>
</li>
</ol>

The complete round-trip took 10.31 ms (including time required to validate the messages, start, and stop the internal mock server).

</details>


&nbsp;

<a id="analysis-format-n-quads"></a>
**Retrieve the Output as RDF N-Quads**

The default response is formatted as JSON.
However, by specifying `format: "n-quads"`, you can retrieve the individual results (e.g., the [Normalized AST](https://github.com/flowr-analysis/flowr/wiki//Normalized%20AST)),
as [RDF N-Quads](https://www.w3.org/TR/n-quads/).
This works with and without the control flow graph as described [above](#analysis-include-cfg).


<details>
<summary>Requesting RDF N-Quads</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

<ol>
<li> <code>hello</code> (response)
<details> 

<summary> Show Details </summary>

The first message is always a hello message.




```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```



</details>
</li>

<li> <b><code>request-file-analysis</code> (request)</b>
<details open> 

<summary> Show Details </summary>






```json
{
  "type": "request-file-analysis",
  "id": "1",
  "filetoken": "x",
  "content": "x <- 1\nx + 1",
  "format": "n-quads",
  "cfg": true
}
```



</details>
</li>

<li> <code>response-file-analysis</code> (response)
<details> 

<summary> Show Details </summary>


Please note, that the base message format is still JSON. Only the individual results get converted. 
While the context is derived from the `filename`, we currently offer no way to customize other parts of the quads 
(please open a [new issue](https://github.com/flowr-analysis/flowr/issues/new/choose) if you require this).
			


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"type":"response-file-analysis","format":"n-quads","id":"1","cfg":"<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"2-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"5-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/1> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/2> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/id> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/name> \"RSymbol\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/2> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/3> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/id> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/name> \"RNumber\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/3> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/4> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/id> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/name> \"RBinaryOp\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/4> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/5> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/id> \"2-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/name> \"binOp-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/5> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/6> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/id> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/name> \"RSymbol\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/6> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/7> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/id> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/name> \"RNumber\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/7> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/8> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/id> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/name> \"RBinaryOp\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/8> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/id> \"5-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/name> \"binOp-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/9> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/10> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/from> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/to> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/type> \"FD\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/10> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/11> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/from> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/to> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/type> \"FD\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/11> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/12> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/from> \"2-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/to> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/type> \"FD\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/12> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/13> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/from> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/to> \"2-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/type> \"FD\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/13> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/13> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/14> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/13> <https://uni-ulm.de/r-ast/from> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/13> <https://uni-ulm.de/r-ast/to> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/13> <https://uni-ulm.de/r-ast/type> \"FD\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/14> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/14> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/15> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/14> <https://uni-ulm.de/r-ast/from> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/14> <https://uni-ulm.de/r-ast/to> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/14> <https://uni-ulm.de/r-ast/type> \"FD\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/15> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/15> <https://uni-ulm.de/r-ast/from> \"5-exit\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/15> <https://uni-ulm.de/r-ast/to> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/15> <https://uni-ulm.de/r-ast/type> \"FD\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/entryPoints> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/exitPoints> \"5-exit\" <unknown> .\n","results":{"parse":"<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/token> \"exprlist\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/text> \"\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/id> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/parent> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/line1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/col1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/line2> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/col2> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/1> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/2> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/line1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/col1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/line2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/col2> \"6\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/id> \"7\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/parent> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/token> \"expr\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/terminal> \"false\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/text> \"x <- 1\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/3> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/4> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/line1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/col1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/line2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/col2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/id> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/parent> \"7\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/token> \"expr\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/terminal> \"false\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/text> \"x\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/5> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/line1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/col1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/line2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/col2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/id> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/parent> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/token> \"SYMBOL\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/terminal> \"true\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/text> \"x\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/4> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/6> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/line1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/col1> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/line2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/col2> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/id> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/parent> \"7\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/token> \"LEFT_ASSIGN\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/terminal> \"true\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/text> \"<-\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/6> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/line1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/col1> \"6\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/line2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/col2> \"6\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/id> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/parent> \"7\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/token> \"expr\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/terminal> \"false\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/text> \"1\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/7> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/line1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/col1> \"6\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/line2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/col2> \"6\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/id> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/parent> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/token> \"NUM_CONST\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/terminal> \"true\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/text> \"1\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/2> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/line1> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/col1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/line2> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/col2> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/id> \"16\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/parent> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/token> \"expr\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/terminal> \"false\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/text> \"x + 1\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/8> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/9> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/line1> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/col1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/line2> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/col2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/id> \"12\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/parent> \"16\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/token> \"expr\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/terminal> \"false\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/text> \"x\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/10> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/line1> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/col1> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/line2> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/col2> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/id> \"10\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/parent> \"12\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/token> \"SYMBOL\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/terminal> \"true\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/text> \"x\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/9> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/11> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/line1> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/col1> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/line2> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/col2> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/id> \"11\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/parent> \"16\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/token> \"+\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/terminal> \"true\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/text> \"+\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/11> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/line1> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/col1> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/line2> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/col2> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/id> \"14\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/parent> \"16\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/token> \"expr\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/terminal> \"false\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/text> \"1\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/12> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/line1> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/col1> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/line2> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/col2> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/id> \"13\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/parent> \"14\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/token> \"NUM_CONST\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/terminal> \"true\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/text> \"1\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/terminal> \"false\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n","normalize":"<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/type> \"RExpressionList\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/1> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/2> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/type> \"RBinaryOp\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/location> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/location> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/lhs> <https://uni-ulm.de/r-ast/unknown/3> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/type> \"RSymbol\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/content> \"x\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/lexeme> \"x\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/rhs> <https://uni-ulm.de/r-ast/unknown/4> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/location> \"6\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/location> \"6\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/lexeme> \"1\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/type> \"RNumber\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/content> <https://uni-ulm.de/r-ast/unknown/5> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/num> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/operator> \"<-\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/lexeme> \"<-\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/children> <https://uni-ulm.de/r-ast/unknown/2> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/type> \"RBinaryOp\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/location> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/location> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/location> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/location> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/lhs> <https://uni-ulm.de/r-ast/unknown/6> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/type> \"RSymbol\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/location> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/location> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/location> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/content> \"x\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/lexeme> \"x\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/rhs> <https://uni-ulm.de/r-ast/unknown/7> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/location> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/location> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/location> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/location> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/lexeme> \"1\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/type> \"RNumber\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/content> <https://uni-ulm.de/r-ast/unknown/8> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/num> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/operator> \"+\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/lexeme> \"+\" <unknown> .\n","dataflow":"<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/rootIds> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/1> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/2> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/tag> \"value\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/1> <https://uni-ulm.de/r-ast/id> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/2> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/3> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/tag> \"variable-definition\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/2> <https://uni-ulm.de/r-ast/id> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/3> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/4> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/tag> \"function-call\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/id> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/name> \"<-\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/onlyBuiltin> \"true\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/args> <https://uni-ulm.de/r-ast/unknown/5> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/6> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/nodeId> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/5> <https://uni-ulm.de/r-ast/type> \"32\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/3> <https://uni-ulm.de/r-ast/args> <https://uni-ulm.de/r-ast/unknown/6> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/nodeId> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/6> <https://uni-ulm.de/r-ast/type> \"32\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/4> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/7> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/tag> \"use\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/4> <https://uni-ulm.de/r-ast/id> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/7> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/8> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/tag> \"value\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/7> <https://uni-ulm.de/r-ast/id> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/vertices> <https://uni-ulm.de/r-ast/unknown/8> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/tag> \"function-call\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/id> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/name> \"+\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/onlyBuiltin> \"true\"^^<http://www.w3.org/2001/XMLSchema#boolean> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/args> <https://uni-ulm.de/r-ast/unknown/9> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/10> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/nodeId> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/9> <https://uni-ulm.de/r-ast/type> \"32\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/8> <https://uni-ulm.de/r-ast/args> <https://uni-ulm.de/r-ast/unknown/10> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/nodeId> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/10> <https://uni-ulm.de/r-ast/type> \"32\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/11> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/12> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/from> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/to> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/11> <https://uni-ulm.de/r-ast/type> \"argument\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/12> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/13> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/from> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/to> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/type> \"returns\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/12> <https://uni-ulm.de/r-ast/type> \"argument\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/13> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/13> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/14> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/13> <https://uni-ulm.de/r-ast/from> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/13> <https://uni-ulm.de/r-ast/to> \"1\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/13> <https://uni-ulm.de/r-ast/type> \"defined-by\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/14> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/14> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/15> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/14> <https://uni-ulm.de/r-ast/from> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/14> <https://uni-ulm.de/r-ast/to> \"2\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/14> <https://uni-ulm.de/r-ast/type> \"defined-by\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/15> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/15> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/16> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/15> <https://uni-ulm.de/r-ast/from> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/15> <https://uni-ulm.de/r-ast/to> \"0\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/15> <https://uni-ulm.de/r-ast/type> \"reads\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/16> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/16> <https://uni-ulm.de/r-ast/next> <https://uni-ulm.de/r-ast/unknown/17> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/16> <https://uni-ulm.de/r-ast/from> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/16> <https://uni-ulm.de/r-ast/to> \"3\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/16> <https://uni-ulm.de/r-ast/type> \"reads\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/16> <https://uni-ulm.de/r-ast/type> \"argument\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/0> <https://uni-ulm.de/r-ast/edges> <https://uni-ulm.de/r-ast/unknown/17> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/17> <https://uni-ulm.de/r-ast/from> \"5\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/17> <https://uni-ulm.de/r-ast/to> \"4\"^^<http://www.w3.org/2001/XMLSchema#integer> <unknown> .\n<https://uni-ulm.de/r-ast/unknown/17> <https://uni-ulm.de/r-ast/type> \"reads\" <unknown> .\n<https://uni-ulm.de/r-ast/unknown/17> <https://uni-ulm.de/r-ast/type> \"argument\" <unknown> .\n"}}
```



</details>
</li>
</ol>

The complete round-trip took 7.25 ms (including time required to validate the messages, start, and stop the internal mock server).

</details>

	

<hr>

<details>
<summary style="color:gray">Message schema (<code>request-file-analysis</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-analysis.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-analysis.ts).

- **.** object 
    - **type** string [required]
        _The type of the message._
        Allows only the values: 'request-file-analysis'
    - **id** string [optional]
        _You may pass an id to link requests with responses (they get the same id)._
    - **filetoken** string [optional]
        _A unique token to identify the file for subsequent requests. Only use this if you plan to send more queries!_
    - **filename** string [optional]
        _A human-readable name of the file, only for debugging purposes._
    - **content** string [optional]
        _The content of the file or an R expression (either give this or the filepath)._
    - **filepath** alternatives [optional]
        _The path to the file(s) on the local machine (either give this or the content)._
        - **.** string 
        - **.** array 
        Valid item types:
            - **.** string 
    - **cfg** boolean [optional]
        _If you want to extract the control flow information of the file._
    - **format** string [optional]
        _The format of the results, if missing we assume json._
        Allows only the values: 'json', 'n-quads'

</details>

<details>
<summary style="color:gray">Message schema (<code>response-file-analysis</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-analysis.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-analysis.ts).

- **.** alternatives [required]
    _The response to a file analysis request (based on the `format` field)._
    - **.** object 
        _The response in JSON format._
        - **type** string [required]
            _The type of the message._
            Allows only the values: 'response-file-analysis'
        - **id** string [optional]
            _The id of the message, if you passed one in the request._
        - **format** string [required]
            _The format of the results in json format._
            Allows only the values: 'json'
        - **results** object [required]
            _The results of the analysis (one field per step)._
        - **cfg** object [optional]
            _The control flow information of the file, only present if requested._
    - **.** object 
        _The response as n-quads._
        - **type** string [required]
            _The type of the message._
            Allows only the values: 'response-file-analysis'
        - **id** string [optional]
            _The id of the message, if you passed one in the request._
        - **format** string [required]
            _The format of the results in n-quads format._
            Allows only the values: 'n-quads'
        - **results** object [required]
            _The results of the analysis (one field per step). Quads are presented as string._
        - **cfg** string [optional]
            _The control flow information of the file, only present if requested._

</details>



<hr>

</details>	
	</li>

<li>
<a id="message-request-slice"></a>
<b>Slice</b> Message (<code>request-slice</code>) 
<details>

<summary style="color:gray"> View Details. <i>(<a href="https://github.com/flowr-analysis/flowr/wiki//Query%20API">deprecated</a>) The server slices a file based on the given criteria.</i> </summary>

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server

    
    Client->>+Server: request-slice

    alt
        Server-->>Client: response-slice
    else
        Server-->>Client: error
    end
    deactivate  Server
	
```


**We deprecated the slice request in favor of the `static-slice` [Query](https://github.com/flowr-analysis/flowr/wiki//Query%20API).**

To slice, you have to send a file analysis request first. The `filetoken` you assign is of use here as you can re-use it to repeatedly slice the same file.
Besides that, you only need to add an array of slicing criteria, using one of the formats described on the [terminology wiki page](https://github.com/flowr-analysis/flowr/wiki//Terminology#slicing-criterion) 
(however, instead of using `;`, you can simply pass separate array elements).
See the implementation of the request-slice message for more information.

Additionally, you may pass `"noMagicComments": true` to disable the automatic selection of elements based on magic comments (see below).


<details>
<summary>Example of the <code>request-slice</code> Message</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

<ol>
<li> <code>hello</code> (response)
<details> 

<summary> Show Details </summary>

The first message is always a hello message.




```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```



</details>
</li>

<li> <code>request-file-analysis</code> (request)
<details> 

<summary> Show Details </summary>

Let's assume you want to slice the following script:

```r
x <- 1
x + 1
```


For this we first request the analysis, using a `filetoken` of `x` to slice the file in the next request.




```json
{
  "type": "request-file-analysis",
  "id": "1",
  "filetoken": "x",
  "content": "x <- 1\nx + 1"
}
```



</details>
</li>

<li> <code>response-file-analysis</code> (response)
<details> 

<summary> Show Details </summary>


See [above](#message-request-file-analysis) for the general structure of the response.
			


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"type":"response-file-analysis","format":"json","id":"1","results":{"parse":{"parsed":"[1,1,1,6,7,0,\"expr\",false,\"x <- 1\"],[1,1,1,1,1,3,\"SYMBOL\",true,\"x\"],[1,1,1,1,3,7,\"expr\",false,\"x\"],[1,3,1,4,2,7,\"LEFT_ASSIGN\",true,\"<-\"],[1,6,1,6,4,5,\"NUM_CONST\",true,\"1\"],[1,6,1,6,5,7,\"expr\",false,\"1\"],[2,1,2,5,16,0,\"expr\",false,\"x + 1\"],[2,1,2,1,10,12,\"SYMBOL\",true,\"x\"],[2,1,2,1,12,16,\"expr\",false,\"x\"],[2,3,2,3,11,16,\"'+'\",true,\"+\"],[2,5,2,5,13,14,\"NUM_CONST\",true,\"1\"],[2,5,2,5,14,16,\"expr\",false,\"1\"]",".meta":{"timing":2}},"normalize":{"ast":{"type":"RExpressionList","children":[{"type":"RBinaryOp","location":[1,3,1,4],"lhs":{"type":"RSymbol","location":[1,1,1,1],"content":"x","lexeme":"x","info":{"fullRange":[1,1,1,1],"additionalTokens":[],"id":0,"parent":2,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-keqPmLqhU6MQ-.R"}},"rhs":{"location":[1,6,1,6],"lexeme":"1","info":{"fullRange":[1,6,1,6],"additionalTokens":[],"id":1,"parent":2,"role":"binop-rhs","index":1,"nesting":0,"file":"/tmp/tmp-5406-keqPmLqhU6MQ-.R"},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"operator":"<-","lexeme":"<-","info":{"fullRange":[1,1,1,6],"additionalTokens":[],"id":2,"parent":6,"nesting":0,"file":"/tmp/tmp-5406-keqPmLqhU6MQ-.R","index":0,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[2,3,2,3],"lhs":{"type":"RSymbol","location":[2,1,2,1],"content":"x","lexeme":"x","info":{"fullRange":[2,1,2,1],"additionalTokens":[],"id":3,"parent":5,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-keqPmLqhU6MQ-.R"}},"rhs":{"location":[2,5,2,5],"lexeme":"1","info":{"fullRange":[2,5,2,5],"additionalTokens":[],"id":4,"parent":5,"role":"binop-rhs","index":1,"nesting":0,"file":"/tmp/tmp-5406-keqPmLqhU6MQ-.R"},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"operator":"+","lexeme":"+","info":{"fullRange":[2,1,2,5],"additionalTokens":[],"id":5,"parent":6,"nesting":0,"file":"/tmp/tmp-5406-keqPmLqhU6MQ-.R","index":1,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":6,"nesting":0,"file":"/tmp/tmp-5406-keqPmLqhU6MQ-.R","role":"root","index":0}},".meta":{"timing":0}},"dataflow":{"unknownReferences":[],"in":[{"nodeId":2,"name":"<-","type":2},{"nodeId":5,"name":"+","type":2}],"out":[{"nodeId":0,"name":"x","type":4,"definedAt":2}],"environment":{"current":{"id":78,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["x",[{"nodeId":0,"name":"x","type":4,"definedAt":2}]]]},"level":0},"graph":{"_unknownSideEffects":[],"rootVertices":[1,0,2,3,4,5],"vertexInformation":[[1,{"tag":"value","id":1}],[0,{"tag":"variable-definition","id":0}],[2,{"tag":"function-call","id":2,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":0,"type":32},{"nodeId":1,"type":32}]}],[3,{"tag":"use","id":3}],[4,{"tag":"value","id":4}],[5,{"tag":"function-call","id":5,"name":"+","onlyBuiltin":true,"args":[{"nodeId":3,"type":32},{"nodeId":4,"type":32}]}]],"edgeInformation":[[2,[[1,{"types":64}],[0,{"types":72}]]],[0,[[1,{"types":2}],[2,{"types":2}]]],[3,[[0,{"types":1}]]],[5,[[3,{"types":65}],[4,{"types":65}]]]]},"entryPoint":2,"exitPoints":[{"type":0,"nodeId":5}],".meta":{"timing":1}}}}
```



</details>
</li>

<li> <b><code>request-slice</code> (request)</b>
<details open> 

<summary> Show Details </summary>

Of course, the second slice criterion `2:1` is redundant for the input, as they refer to the same variable. It is only for demonstration purposes.




```json
{
  "type": "request-slice",
  "id": "2",
  "filetoken": "x",
  "criterion": [
    "2@x",
    "2:1"
  ]
}
```



</details>
</li>

<li> <code>response-slice</code> (response)
<details> 

<summary> Show Details </summary>


The `results` field of the response contains two keys of importance:

- `slice`: which contains the result of the slicing (e.g., the ids included in the slice in `result`).
- `reconstruct`: contains the reconstructed code, as well as additional meta information. 
                   The automatically selected lines correspond to additional filters (e.g., magic comments) which force the unconditiojnal inclusion of certain elements.





```json
{
  "type": "response-slice",
  "id": "2",
  "results": {
    "slice": {
      "timesHitThreshold": 0,
      "result": [
        3,
        0,
        1,
        2
      ],
      "decodedCriteria": [
        {
          "criterion": "2@x",
          "id": 3
        },
        {
          "criterion": "2:1",
          "id": 3
        }
      ],
      ".meta": {
        "timing": 2
      }
    },
    "reconstruct": {
      "code": "x <- 1\nx",
      "linesWithAutoSelected": 0,
      ".meta": {
        "timing": 0
      }
    }
  }
}
```



</details>
</li>
</ol>

The complete round-trip took 6.65 ms (including time required to validate the messages, start, and stop the internal mock server).

</details>


The semantics of the error message are similar. If, for example, the slicing criterion is invalid or the `filetoken` is unknown, _flowR_ will respond with an error.

&nbsp;

<a id="slice-magic-comments"></a>
**Magic Comments**


Within a document that is to be sliced, you can use magic comments to influence the slicing process:

- `# flowr@include_next_line` will cause the next line to be included, independent of if it is important for the slice.
- `# flowr@include_this_line` will cause the current line to be included, independent of if it is important for the slice.
- `# flowr@include_start` and `# flowr@include_end` will cause the lines between them to be included, independent of if they are important for the slice. These magic comments can be nested but should appear on a separate line.

	

<hr>

<details>
<summary style="color:gray">Message schema (<code>request-slice</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-slice.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-slice.ts).

- **.** object 
    - **type** string [required]
        _The type of the message._
        Allows only the values: 'request-slice'
    - **id** string [optional]
        _The id of the message, if you passed one in the request._
    - **filetoken** string [required]
        _The filetoken of the file to slice must be the same as with the analysis request._
    - **criterion** array [required]
        _The slicing criteria to use._
    Valid item types:
        - **.** string 

</details>

<details>
<summary style="color:gray">Message schema (<code>response-slice</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-slice.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-slice.ts).

- **.** object 
    _The response to a slice request._
    - **type** string [required]
        _The type of the message._
        Allows only the values: 'response-slice'
    - **id** string [optional]
        _The id of the message, if you passed one in the request._
    - **results** object [required]
        _The results of the slice (one field per step slicing step)._

</details>



<hr>

</details>	
	</li>

<li>
<a id="message-request-repl-execution"></a>
<b>REPL</b> Message (<code>request-repl-execution</code>) 
<details>

<summary style="color:gray"> View Details. <i>Access the read evaluate print loop of flowR.</i> </summary>

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server

    
    Client->>+Server: request-repl-execution

    alt
        Server-->>Client: error
    else

    loop
        Server-->>Client: response-repl-execution
    end
        Server-->>Client: end-repl-execution

    end

    deactivate  Server
	
```


> [!WARNING]
> To execute arbitrary R commands with a request, the server has to be started explicitly with <span title="Description (Command Line Argument): Allow to access the underlying R session when using flowR (security warning: this allows the execution of arbitrary R code!)">`--r-session-access`</span>.
> Please be aware that this introduces a security risk.


The REPL execution message allows to send a REPL command to receive its output. 
For more on the REPL, see the [introduction](https://github.com/flowr-analysis/flowr/wiki//Overview#the-read-eval-print-loop-repl), or the [description below](#using-the-repl).
You only have to pass the command you want to execute in the `expression` field. 
Furthermore, you can set the `ansi` field to `true` if you are interested in output formatted using [ANSI escape codes](https://en.wikipedia.org/wiki/ANSI_escape_code).
We strongly recommend you to make use of the `id` field to link answers with requests as you can theoretically request the execution of multiple scripts at the same time, which then happens in parallel.

> [!WARNING]
> There is currently no automatic sandboxing or safeguarding against such requests. They simply execute the respective&nbsp;R code on your machine. 
> Please be very careful (and do not use <span title="Description (Command Line Argument): Allow to access the underlying R session when using flowR (security warning: this allows the execution of arbitrary R code!)">`--r-session-access`</span> if you are unsure).


The answer on such a request is different from the other messages as the `response-repl-execution` message may be sent multiple times. 
This allows to better handle requests that require more time but already output intermediate results.
You can detect the end of the execution by receiving the `end-repl-execution` message.

The semantics of the error message are similar to that of the other messages.

<details>
<summary>Example of the <code>request-slice</code> Message</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

<ol>
<li> <code>hello</code> (response)
<details> 

<summary> Show Details </summary>

The first message is always a hello message.




```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```



</details>
</li>

<li> <b><code>request-repl-execution</code> (request)</b>
<details open> 

<summary> Show Details </summary>






```json
{
  "type": "request-repl-execution",
  "id": "1",
  "expression": ":help"
}
```



</details>
</li>

<li> <code>response-repl-execution</code> (response)
<details> 

<summary> Show Details </summary>


The `stream` field (either `stdout` or `stderr`) informs you of the output's origin: either the standard output or the standard error channel. After this message follows the end marker.


<details>
<summary>Pretty-Printed Result</summary>


```text
If enabled ('--r-session-access'), you can just enter R expressions which get evaluated right away:
R> 1 + 1
[1] 2

Besides that, you can use the following commands. The scripts can accept further arguments. In general, those ending with [*] may be called with and without the star. 
There are the following basic commands:
  :controlflow[*]  Get mermaid code for the control-flow graph of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (aliases: :cfg, :cf)
  :dataflow[*]     Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (aliases: :d, :df)
  :execute         Execute the given code as R code (essentially similar to using now command) (aliases: :e, :r)
  :help            Show help information (aliases: :h, :?)
  :lineage         Get the lineage of an R object (alias: :lin)
  :normalize[*]    Get mermaid code for the normalized AST of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (alias: :n)
  :parse           Prints ASCII Art of the parsed, unmodified AST, start with 'file://' to indicate a file (alias: :p)
  :query[*]        Query the given R code, start with 'file://' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information). (star: Similar to query, but returns the output in json format.)
  :quit            End the repl (aliases: :q, :exit)
  :version         Prints the version of flowR as well as the current version of R

Furthermore, you can directly call the following scripts which accept arguments. If you are unsure, try to add --help after the command.
  :benchmark       Benchmark the static backwards slicer
  :export-quads    Export quads of the normalized AST of a given R code file
  :slicer          Static backwards executable slicer for R
  :stats           Generate usage Statistics for R scripts
  :summarizer      Summarize the results of the benchmark

You can combine commands by separating them with a semicolon ;.
```


</details>
				




```json
{
  "type": "response-repl-execution",
  "id": "1",
  "result": "\nIf enabled ('--r-session-access'), you can just enter R expressions which get evaluated right away:\nR> 1 + 1\n[1] 2\n\nBesides that, you can use the following commands. The scripts can accept further arguments. In general, those ending with [*] may be called with and without the star. \nThere are the following basic commands:\n  :controlflow[*]  Get mermaid code for the control-flow graph of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (aliases: :cfg, :cf)\n  :dataflow[*]     Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (aliases: :d, :df)\n  :execute         Execute the given code as R code (essentially similar to using now command) (aliases: :e, :r)\n  :help            Show help information (aliases: :h, :?)\n  :lineage         Get the lineage of an R object (alias: :lin)\n  :normalize[*]    Get mermaid code for the normalized AST of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (alias: :n)\n  :parse           Prints ASCII Art of the parsed, unmodified AST, start with 'file://' to indicate a file (alias: :p)\n  :query[*]        Query the given R code, start with 'file://' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information). (star: Similar to query, but returns the output in json format.)\n  :quit            End the repl (aliases: :q, :exit)\n  :version         Prints the version of flowR as well as the current version of R\n\nFurthermore, you can directly call the following scripts which accept arguments. If you are unsure, try to add --help after the command.\n  :benchmark       Benchmark the static backwards slicer\n  :export-quads    Export quads of the normalized AST of a given R code file\n  :slicer          Static backwards executable slicer for R\n  :stats           Generate usage Statistics for R scripts\n  :summarizer      Summarize the results of the benchmark\n\nYou can combine commands by separating them with a semicolon ;.\n",
  "stream": "stdout"
}
```



</details>
</li>

<li> <code>end-repl-execution</code> (response)
<details> 

<summary> Show Details </summary>






```json
{
  "type": "end-repl-execution",
  "id": "1"
}
```



</details>
</li>
</ol>

The complete round-trip took 1.24 ms (including time required to validate the messages, start, and stop the internal mock server).

</details>

	

<hr>

<details>
<summary style="color:gray">Message schema (<code>request-repl-execution</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-repl.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-repl.ts).

- **.** object 
    - **type** string [required]
        _The type of the message._
        Allows only the values: 'request-repl-execution'
    - **id** string [optional]
        _The id of the message, will be the same for the request._
    - **ansi** boolean [optional]
        _Should ansi formatting be enabled for the response? Is `false` by default._
    - **expression** string [required]
        _The expression to execute._

</details>

<details>
<summary style="color:gray">Message schema (<code>response-repl-execution</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-repl.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-repl.ts).

- **.** object 
    - **type** string [required]
        _The type of the message._
        Allows only the values: 'response-repl-execution'
    - **id** string [optional]
        _The id of the message, will be the same for the request._
    - **stream** string [required]
        _The stream the message is from._
        Allows only the values: 'stdout', 'stderr'
    - **result** string [required]
        _The output of the execution._

</details>

<details>
<summary style="color:gray">Message schema (<code>end-repl-execution</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-repl.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-repl.ts).

- **.** object 
    - **type** string [required]
        _The type of the message._
        Allows only the values: 'end-repl-execution'
    - **id** string [optional]
        _The id of the message, will be the same for the request._

</details>


<hr>

</details>	
	</li>

<li>
<a id="message-request-query"></a>
<b>Query</b> Message (<code>request-query</code>) 
<details>

<summary style="color:gray"> View Details. <i>Query an analysis result for specific information.</i> </summary>

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server

    
    Client->>+Server: request-query

    alt
        Server-->>Client: response-query
    else
        Server-->>Client: error
    end
    deactivate  Server
	
```


To send queries, you have to send an [analysis request](#message-request-file-analysis) first. The `filetoken` you assign is of use here as you can re-use it to repeatedly query the same file.
This message provides direct access to _flowR_'s Query API. Please consult the [Query API documentation](https://github.com/flowr-analysis/flowr/wiki//Query%20API) for more information.


<details>
<summary>Example of the <code>request-query</code> Message</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

<ol>
<li> <code>hello</code> (response)
<details> 

<summary> Show Details </summary>

The first message is always a hello message.




```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```



</details>
</li>

<li> <code>request-file-analysis</code> (request)
<details> 

<summary> Show Details </summary>

Let's assume you want to query the following script:

```r
library(ggplot)
library(dplyr)
library(readr)

# read data with read_csv
data <- read_csv('data.csv')
data2 <- read_csv('data2.csv')

m <- mean(data$x) 
print(m)

data %>%
	ggplot(aes(x = x, y = y)) +
	geom_point()
	
plot(data2$x, data2$y)
points(data2$x, data2$y)
	
print(mean(data2$k))
```
.

For this we first request the analysis, using a dummy `filetoken` of `x` to slice the file in the next request.




```json
{
  "type": "request-file-analysis",
  "id": "1",
  "filetoken": "x",
  "content": "library(ggplot)\nlibrary(dplyr)\nlibrary(readr)\n\n# read data with read_csv\ndata <- read_csv('data.csv')\ndata2 <- read_csv('data2.csv')\n\nm <- mean(data$x) \nprint(m)\n\ndata %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()\n\t\nplot(data2$x, data2$y)\npoints(data2$x, data2$y)\n\t\nprint(mean(data2$k))"
}
```



</details>
</li>

<li> <code>response-file-analysis</code> (response)
<details> 

<summary> Show Details </summary>


See [above](#message-request-file-analysis) for the general structure of the response.
			


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"type":"response-file-analysis","format":"json","id":"1","results":{"parse":{"parsed":"[1,1,1,15,10,0,\"expr\",false,\"library(ggplot)\"],[1,1,1,7,1,3,\"SYMBOL_FUNCTION_CALL\",true,\"library\"],[1,1,1,7,3,10,\"expr\",false,\"library\"],[1,8,1,8,2,10,\"'('\",true,\"(\"],[1,9,1,14,4,6,\"SYMBOL\",true,\"ggplot\"],[1,9,1,14,6,10,\"expr\",false,\"ggplot\"],[1,15,1,15,5,10,\"')'\",true,\")\"],[2,1,2,14,23,0,\"expr\",false,\"library(dplyr)\"],[2,1,2,7,14,16,\"SYMBOL_FUNCTION_CALL\",true,\"library\"],[2,1,2,7,16,23,\"expr\",false,\"library\"],[2,8,2,8,15,23,\"'('\",true,\"(\"],[2,9,2,13,17,19,\"SYMBOL\",true,\"dplyr\"],[2,9,2,13,19,23,\"expr\",false,\"dplyr\"],[2,14,2,14,18,23,\"')'\",true,\")\"],[3,1,3,14,36,0,\"expr\",false,\"library(readr)\"],[3,1,3,7,27,29,\"SYMBOL_FUNCTION_CALL\",true,\"library\"],[3,1,3,7,29,36,\"expr\",false,\"library\"],[3,8,3,8,28,36,\"'('\",true,\"(\"],[3,9,3,13,30,32,\"SYMBOL\",true,\"readr\"],[3,9,3,13,32,36,\"expr\",false,\"readr\"],[3,14,3,14,31,36,\"')'\",true,\")\"],[5,1,5,25,42,-59,\"COMMENT\",true,\"# read data with read_csv\"],[6,1,6,28,59,0,\"expr\",false,\"data <- read_csv('data.csv')\"],[6,1,6,4,45,47,\"SYMBOL\",true,\"data\"],[6,1,6,4,47,59,\"expr\",false,\"data\"],[6,6,6,7,46,59,\"LEFT_ASSIGN\",true,\"<-\"],[6,9,6,28,57,59,\"expr\",false,\"read_csv('data.csv')\"],[6,9,6,16,48,50,\"SYMBOL_FUNCTION_CALL\",true,\"read_csv\"],[6,9,6,16,50,57,\"expr\",false,\"read_csv\"],[6,17,6,17,49,57,\"'('\",true,\"(\"],[6,18,6,27,51,53,\"STR_CONST\",true,\"'data.csv'\"],[6,18,6,27,53,57,\"expr\",false,\"'data.csv'\"],[6,28,6,28,52,57,\"')'\",true,\")\"],[7,1,7,30,76,0,\"expr\",false,\"data2 <- read_csv('data2.csv')\"],[7,1,7,5,62,64,\"SYMBOL\",true,\"data2\"],[7,1,7,5,64,76,\"expr\",false,\"data2\"],[7,7,7,8,63,76,\"LEFT_ASSIGN\",true,\"<-\"],[7,10,7,30,74,76,\"expr\",false,\"read_csv('data2.csv')\"],[7,10,7,17,65,67,\"SYMBOL_FUNCTION_CALL\",true,\"read_csv\"],[7,10,7,17,67,74,\"expr\",false,\"read_csv\"],[7,18,7,18,66,74,\"'('\",true,\"(\"],[7,19,7,29,68,70,\"STR_CONST\",true,\"'data2.csv'\"],[7,19,7,29,70,74,\"expr\",false,\"'data2.csv'\"],[7,30,7,30,69,74,\"')'\",true,\")\"],[9,1,9,17,98,0,\"expr\",false,\"m <- mean(data$x)\"],[9,1,9,1,81,83,\"SYMBOL\",true,\"m\"],[9,1,9,1,83,98,\"expr\",false,\"m\"],[9,3,9,4,82,98,\"LEFT_ASSIGN\",true,\"<-\"],[9,6,9,17,96,98,\"expr\",false,\"mean(data$x)\"],[9,6,9,9,84,86,\"SYMBOL_FUNCTION_CALL\",true,\"mean\"],[9,6,9,9,86,96,\"expr\",false,\"mean\"],[9,10,9,10,85,96,\"'('\",true,\"(\"],[9,11,9,16,91,96,\"expr\",false,\"data$x\"],[9,11,9,14,87,89,\"SYMBOL\",true,\"data\"],[9,11,9,14,89,91,\"expr\",false,\"data\"],[9,15,9,15,88,91,\"'$'\",true,\"$\"],[9,16,9,16,90,91,\"SYMBOL\",true,\"x\"],[9,17,9,17,92,96,\"')'\",true,\")\"],[10,1,10,8,110,0,\"expr\",false,\"print(m)\"],[10,1,10,5,101,103,\"SYMBOL_FUNCTION_CALL\",true,\"print\"],[10,1,10,5,103,110,\"expr\",false,\"print\"],[10,6,10,6,102,110,\"'('\",true,\"(\"],[10,7,10,7,104,106,\"SYMBOL\",true,\"m\"],[10,7,10,7,106,110,\"expr\",false,\"m\"],[10,8,10,8,105,110,\"')'\",true,\")\"],[12,1,14,20,158,0,\"expr\",false,\"data %>%\\n\\tggplot(aes(x = x, y = y)) +\\n\\tgeom_point()\"],[12,1,13,33,149,158,\"expr\",false,\"data %>%\\n\\tggplot(aes(x = x, y = y))\"],[12,1,12,4,116,118,\"SYMBOL\",true,\"data\"],[12,1,12,4,118,149,\"expr\",false,\"data\"],[12,6,12,8,117,149,\"SPECIAL\",true,\"%>%\"],[13,9,13,33,147,149,\"expr\",false,\"ggplot(aes(x = x, y = y))\"],[13,9,13,14,120,122,\"SYMBOL_FUNCTION_CALL\",true,\"ggplot\"],[13,9,13,14,122,147,\"expr\",false,\"ggplot\"],[13,15,13,15,121,147,\"'('\",true,\"(\"],[13,16,13,32,142,147,\"expr\",false,\"aes(x = x, y = y)\"],[13,16,13,18,123,125,\"SYMBOL_FUNCTION_CALL\",true,\"aes\"],[13,16,13,18,125,142,\"expr\",false,\"aes\"],[13,19,13,19,124,142,\"'('\",true,\"(\"],[13,20,13,20,126,142,\"SYMBOL_SUB\",true,\"x\"],[13,22,13,22,127,142,\"EQ_SUB\",true,\"=\"],[13,24,13,24,128,130,\"SYMBOL\",true,\"x\"],[13,24,13,24,130,142,\"expr\",false,\"x\"],[13,25,13,25,129,142,\"','\",true,\",\"],[13,27,13,27,134,142,\"SYMBOL_SUB\",true,\"y\"],[13,29,13,29,135,142,\"EQ_SUB\",true,\"=\"],[13,31,13,31,136,138,\"SYMBOL\",true,\"y\"],[13,31,13,31,138,142,\"expr\",false,\"y\"],[13,32,13,32,137,142,\"')'\",true,\")\"],[13,33,13,33,143,147,\"')'\",true,\")\"],[13,35,13,35,148,158,\"'+'\",true,\"+\"],[14,9,14,20,156,158,\"expr\",false,\"geom_point()\"],[14,9,14,18,151,153,\"SYMBOL_FUNCTION_CALL\",true,\"geom_point\"],[14,9,14,18,153,156,\"expr\",false,\"geom_point\"],[14,19,14,19,152,156,\"'('\",true,\"(\"],[14,20,14,20,154,156,\"')'\",true,\")\"],[16,1,16,22,184,0,\"expr\",false,\"plot(data2$x, data2$y)\"],[16,1,16,4,163,165,\"SYMBOL_FUNCTION_CALL\",true,\"plot\"],[16,1,16,4,165,184,\"expr\",false,\"plot\"],[16,5,16,5,164,184,\"'('\",true,\"(\"],[16,6,16,12,170,184,\"expr\",false,\"data2$x\"],[16,6,16,10,166,168,\"SYMBOL\",true,\"data2\"],[16,6,16,10,168,170,\"expr\",false,\"data2\"],[16,11,16,11,167,170,\"'$'\",true,\"$\"],[16,12,16,12,169,170,\"SYMBOL\",true,\"x\"],[16,13,16,13,171,184,\"','\",true,\",\"],[16,15,16,21,179,184,\"expr\",false,\"data2$y\"],[16,15,16,19,175,177,\"SYMBOL\",true,\"data2\"],[16,15,16,19,177,179,\"expr\",false,\"data2\"],[16,20,16,20,176,179,\"'$'\",true,\"$\"],[16,21,16,21,178,179,\"SYMBOL\",true,\"y\"],[16,22,16,22,180,184,\"')'\",true,\")\"],[17,1,17,24,209,0,\"expr\",false,\"points(data2$x, data2$y)\"],[17,1,17,6,188,190,\"SYMBOL_FUNCTION_CALL\",true,\"points\"],[17,1,17,6,190,209,\"expr\",false,\"points\"],[17,7,17,7,189,209,\"'('\",true,\"(\"],[17,8,17,14,195,209,\"expr\",false,\"data2$x\"],[17,8,17,12,191,193,\"SYMBOL\",true,\"data2\"],[17,8,17,12,193,195,\"expr\",false,\"data2\"],[17,13,17,13,192,195,\"'$'\",true,\"$\"],[17,14,17,14,194,195,\"SYMBOL\",true,\"x\"],[17,15,17,15,196,209,\"','\",true,\",\"],[17,17,17,23,204,209,\"expr\",false,\"data2$y\"],[17,17,17,21,200,202,\"SYMBOL\",true,\"data2\"],[17,17,17,21,202,204,\"expr\",false,\"data2\"],[17,22,17,22,201,204,\"'$'\",true,\"$\"],[17,23,17,23,203,204,\"SYMBOL\",true,\"y\"],[17,24,17,24,205,209,\"')'\",true,\")\"],[19,1,19,20,235,0,\"expr\",false,\"print(mean(data2$k))\"],[19,1,19,5,215,217,\"SYMBOL_FUNCTION_CALL\",true,\"print\"],[19,1,19,5,217,235,\"expr\",false,\"print\"],[19,6,19,6,216,235,\"'('\",true,\"(\"],[19,7,19,19,230,235,\"expr\",false,\"mean(data2$k)\"],[19,7,19,10,218,220,\"SYMBOL_FUNCTION_CALL\",true,\"mean\"],[19,7,19,10,220,230,\"expr\",false,\"mean\"],[19,11,19,11,219,230,\"'('\",true,\"(\"],[19,12,19,18,225,230,\"expr\",false,\"data2$k\"],[19,12,19,16,221,223,\"SYMBOL\",true,\"data2\"],[19,12,19,16,223,225,\"expr\",false,\"data2\"],[19,17,19,17,222,225,\"'$'\",true,\"$\"],[19,18,19,18,224,225,\"SYMBOL\",true,\"k\"],[19,19,19,19,226,230,\"')'\",true,\")\"],[19,20,19,20,231,235,\"')'\",true,\")\"]",".meta":{"timing":9}},"normalize":{"ast":{"type":"RExpressionList","children":[{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"id":0,"parent":3,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"id":1,"parent":2,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[1,9,1,14],"additionalTokens":[],"id":2,"parent":3,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"id":3,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"id":4,"parent":7,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"id":5,"parent":6,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[2,9,2,13],"additionalTokens":[],"id":6,"parent":7,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"id":7,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"id":8,"parent":11,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"id":9,"parent":10,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[3,9,3,13],"additionalTokens":[],"id":10,"parent":11,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"id":11,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":2,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"id":13,"parent":16,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"id":14,"parent":15,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[6,18,6,27],"additionalTokens":[],"id":15,"parent":16,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"id":16,"parent":17,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[]}}],"id":17,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":3,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"id":19,"parent":22,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"id":20,"parent":21,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[7,19,7,29],"additionalTokens":[],"id":21,"parent":22,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"id":22,"parent":23,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"id":23,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":4,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"id":25,"parent":31,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"id":26,"parent":29,"role":"accessed","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"id":27,"parent":28,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[9,16,9,16],"additionalTokens":[],"id":28,"parent":29,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"id":29,"parent":30,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"id":30,"parent":31,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"id":31,"parent":32,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"id":32,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":5,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"id":33,"parent":36,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"id":34,"parent":35,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[10,7,10,7],"additionalTokens":[],"id":35,"parent":36,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"id":36,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":6,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"id":38,"parent":39,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"id":40,"parent":50,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"id":41,"parent":48,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"id":42,"parent":44,"role":"arg-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"id":43,"parent":44,"role":"arg-value","index":1,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[13,20,13,20],"additionalTokens":[],"id":44,"parent":48,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"id":45,"parent":47,"role":"arg-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"id":46,"parent":47,"role":"arg-value","index":1,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[13,27,13,27],"additionalTokens":[],"id":47,"parent":48,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"id":48,"parent":49,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"id":49,"parent":50,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"id":50,"parent":51,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"id":53,"parent":54,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"id":54,"parent":55,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"id":55,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":7,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"id":56,"parent":67,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"id":57,"parent":60,"role":"accessed","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"id":58,"parent":59,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[16,12,16,12],"additionalTokens":[],"id":59,"parent":60,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"id":60,"parent":61,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"id":61,"parent":67,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"id":62,"parent":65,"role":"accessed","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"id":63,"parent":64,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[16,21,16,21],"additionalTokens":[],"id":64,"parent":65,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"id":65,"parent":66,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"id":66,"parent":67,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"id":67,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":8,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"id":68,"parent":79,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"id":69,"parent":72,"role":"accessed","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"id":70,"parent":71,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[17,14,17,14],"additionalTokens":[],"id":71,"parent":72,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"id":72,"parent":73,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"id":73,"parent":79,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"id":74,"parent":77,"role":"accessed","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"id":75,"parent":76,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[17,23,17,23],"additionalTokens":[],"id":76,"parent":77,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"id":77,"parent":78,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"id":78,"parent":79,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"id":79,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":9,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"id":80,"parent":89,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"id":81,"parent":87,"role":"call-name","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"id":82,"parent":85,"role":"accessed","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"id":83,"parent":84,"role":"arg-value","index":0,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R"}},"info":{"fullRange":[19,18,19,18],"additionalTokens":[],"id":84,"parent":85,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"id":85,"parent":86,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"id":86,"parent":87,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"id":87,"parent":88,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"id":88,"parent":89,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"id":89,"parent":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","index":10,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":90,"nesting":0,"file":"/tmp/tmp-5406-gd8I2ET2Oeqw-.R","role":"root","index":0}},".meta":{"timing":2}},"dataflow":{"unknownReferences":[],"in":[{"nodeId":3,"name":"library","type":2},{"nodeId":7,"name":"library","type":2},{"nodeId":11,"name":"library","type":2},{"nodeId":17,"name":"<-","type":2},{"nodeId":23,"name":"<-","type":2},{"nodeId":32,"name":"<-","type":2},{"nodeId":16,"name":"read_csv","type":2},{"nodeId":22,"name":"read_csv","type":2},{"nodeId":31,"name":"mean","type":2},{"nodeId":36,"name":"print","type":2},{"nodeId":89,"name":"print","type":2},{"nodeId":43,"name":"x","type":1},{"nodeId":46,"name":"y","type":1},{"nodeId":48,"name":"aes","type":2},{"nodeId":50,"name":"ggplot","type":2},{"nodeId":54,"name":"geom_point","type":2},{"nodeId":55,"name":"+","type":2},{"nodeId":67,"name":"plot","type":2},{"nodeId":79,"name":"points","type":2}],"out":[{"nodeId":12,"name":"data","type":1,"definedAt":17},{"nodeId":18,"name":"data2","type":1,"definedAt":23},{"nodeId":24,"name":"m","type":1,"definedAt":32}],"environment":{"current":{"id":187,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"graph":{"_unknownSideEffects":[3,7,11,{"id":36,"linkTo":{"type":"link-to-last-call","callName":{}}},{"id":67,"linkTo":{"type":"link-to-last-call","callName":{}}},{"id":89,"linkTo":{"type":"link-to-last-call","callName":{}}}],"rootVertices":[1,3,5,7,9,11,14,16,12,17,20,22,18,23,26,27,29,31,24,32,34,36,38,43,44,46,47,48,50,52,54,55,57,58,60,62,63,65,67,69,70,72,74,75,77,79,82,83,85,87,89],"vertexInformation":[[1,{"tag":"value","id":1}],[3,{"tag":"function-call","id":3,"name":"library","onlyBuiltin":true,"args":[{"nodeId":1,"type":32}]}],[5,{"tag":"value","id":5}],[7,{"tag":"function-call","id":7,"name":"library","onlyBuiltin":true,"args":[{"nodeId":5,"type":32}]}],[9,{"tag":"value","id":9}],[11,{"tag":"function-call","id":11,"name":"library","onlyBuiltin":true,"args":[{"nodeId":9,"type":32}]}],[14,{"tag":"value","id":14}],[16,{"tag":"function-call","id":16,"environment":{"current":{"id":94,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[]},"level":0},"name":"read_csv","onlyBuiltin":false,"args":[{"nodeId":14,"type":32}]}],[12,{"tag":"variable-definition","id":12}],[17,{"tag":"function-call","id":17,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":12,"type":32},{"nodeId":16,"type":32}]}],[20,{"tag":"value","id":20}],[22,{"tag":"function-call","id":22,"environment":{"current":{"id":104,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]]]},"level":0},"name":"read_csv","onlyBuiltin":false,"args":[{"nodeId":20,"type":32}]}],[18,{"tag":"variable-definition","id":18}],[23,{"tag":"function-call","id":23,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":18,"type":32},{"nodeId":22,"type":32}]}],[26,{"tag":"use","id":26}],[27,{"tag":"value","id":27}],[29,{"tag":"function-call","id":29,"name":"$","onlyBuiltin":true,"args":[{"nodeId":26,"type":32},{"nodeId":27,"type":32}]}],[31,{"tag":"function-call","id":31,"name":"mean","onlyBuiltin":true,"args":[{"nodeId":29,"type":32}]}],[24,{"tag":"variable-definition","id":24}],[32,{"tag":"function-call","id":32,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":24,"type":32},{"nodeId":31,"type":32}]}],[34,{"tag":"use","id":34}],[36,{"tag":"function-call","id":36,"name":"print","onlyBuiltin":true,"args":[{"nodeId":34,"type":32}]}],[38,{"tag":"use","id":38}],[43,{"tag":"use","id":43}],[44,{"tag":"use","id":44}],[46,{"tag":"use","id":46}],[47,{"tag":"use","id":47}],[48,{"tag":"function-call","id":48,"environment":{"current":{"id":136,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"aes","onlyBuiltin":false,"args":[{"nodeId":44,"name":"x","type":32},{"nodeId":47,"name":"y","type":32}]}],[50,{"tag":"function-call","id":50,"environment":{"current":{"id":139,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"ggplot","onlyBuiltin":false,"args":[{"nodeId":38,"type":2},{"nodeId":48,"type":32}]}],[52,{"tag":"function-call","id":52,"name":"%>%","onlyBuiltin":true,"args":[{"nodeId":38,"type":32},{"nodeId":50,"type":32}]}],[54,{"tag":"function-call","id":54,"environment":{"current":{"id":145,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"geom_point","onlyBuiltin":false,"args":[]}],[55,{"tag":"function-call","id":55,"name":"+","onlyBuiltin":true,"args":[{"nodeId":52,"type":32},{"nodeId":54,"type":32}]}],[57,{"tag":"use","id":57}],[58,{"tag":"value","id":58}],[60,{"tag":"function-call","id":60,"name":"$","onlyBuiltin":true,"args":[{"nodeId":57,"type":32},{"nodeId":58,"type":32}]}],[62,{"tag":"use","id":62}],[63,{"tag":"value","id":63}],[65,{"tag":"function-call","id":65,"name":"$","onlyBuiltin":true,"args":[{"nodeId":62,"type":32},{"nodeId":63,"type":32}]}],[67,{"tag":"function-call","id":67,"name":"plot","onlyBuiltin":true,"args":[{"nodeId":60,"type":32},{"nodeId":65,"type":32}]}],[69,{"tag":"use","id":69}],[70,{"tag":"value","id":70}],[72,{"tag":"function-call","id":72,"name":"$","onlyBuiltin":true,"args":[{"nodeId":69,"type":32},{"nodeId":70,"type":32}]}],[74,{"tag":"use","id":74}],[75,{"tag":"value","id":75}],[77,{"tag":"function-call","id":77,"name":"$","onlyBuiltin":true,"args":[{"nodeId":74,"type":32},{"nodeId":75,"type":32}]}],[79,{"tag":"function-call","id":79,"name":"points","onlyBuiltin":true,"args":[{"nodeId":72,"type":32},{"nodeId":77,"type":32}]}],[82,{"tag":"use","id":82}],[83,{"tag":"value","id":83}],[85,{"tag":"function-call","id":85,"name":"$","onlyBuiltin":true,"args":[{"nodeId":82,"type":32},{"nodeId":83,"type":32}]}],[87,{"tag":"function-call","id":87,"name":"mean","onlyBuiltin":true,"args":[{"nodeId":85,"type":32}]}],[89,{"tag":"function-call","id":89,"name":"print","onlyBuiltin":true,"args":[{"nodeId":87,"type":32}]}]],"edgeInformation":[[3,[[1,{"types":64}]]],[7,[[5,{"types":64}]]],[11,[[9,{"types":64}]]],[16,[[14,{"types":64}]]],[17,[[16,{"types":64}],[12,{"types":72}]]],[12,[[16,{"types":2}],[17,{"types":2}]]],[22,[[20,{"types":64}]]],[23,[[22,{"types":64}],[18,{"types":72}]]],[18,[[22,{"types":2}],[23,{"types":2}]]],[26,[[12,{"types":1}]]],[29,[[26,{"types":73}],[27,{"types":65}]]],[31,[[29,{"types":65}]]],[32,[[31,{"types":64}],[24,{"types":72}]]],[24,[[31,{"types":2}],[32,{"types":2}]]],[34,[[24,{"types":1}]]],[36,[[34,{"types":73}]]],[38,[[12,{"types":1}]]],[52,[[38,{"types":64}],[50,{"types":64}]]],[44,[[43,{"types":1}]]],[48,[[43,{"types":1}],[44,{"types":64}],[46,{"types":1}],[47,{"types":64}]]],[47,[[46,{"types":1}]]],[50,[[48,{"types":65}],[38,{"types":64}]]],[55,[[52,{"types":65}],[54,{"types":65}]]],[57,[[18,{"types":1}]]],[60,[[57,{"types":73}],[58,{"types":65}]]],[67,[[60,{"types":65}],[65,{"types":65}]]],[62,[[18,{"types":1}]]],[65,[[62,{"types":73}],[63,{"types":65}]]],[69,[[18,{"types":1}]]],[72,[[69,{"types":73}],[70,{"types":65}]]],[79,[[72,{"types":65}],[77,{"types":65}],[67,{"types":1}]]],[74,[[18,{"types":1}]]],[77,[[74,{"types":73}],[75,{"types":65}]]],[82,[[18,{"types":1}]]],[85,[[82,{"types":73}],[83,{"types":65}]]],[87,[[85,{"types":65}]]],[89,[[87,{"types":73}]]]]},"entryPoint":3,"exitPoints":[{"type":0,"nodeId":89}],".meta":{"timing":4}}}}
```



</details>
</li>

<li> <b><code>request-query</code> (request)</b>
<details open> 

<summary> Show Details </summary>






```json
{
  "type": "request-query",
  "id": "2",
  "filetoken": "x",
  "query": [
    {
      "type": "compound",
      "query": "call-context",
      "commonArguments": {
        "kind": "visualize",
        "subkind": "text",
        "callTargets": "global"
      },
      "arguments": [
        {
          "callName": "^mean$"
        },
        {
          "callName": "^print$",
          "callTargets": "local"
        }
      ]
    }
  ]
}
```



</details>
</li>

<li> <code>response-query</code> (response)
<details> 

<summary> Show Details </summary>






```json
{
  "type": "response-query",
  "id": "2",
  "results": {
    "call-context": {
      ".meta": {
        "timing": 1
      },
      "kinds": {
        "visualize": {
          "subkinds": {
            "text": [
              {
                "id": 31,
                "name": "mean",
                "calls": [
                  "built-in"
                ]
              },
              {
                "id": 87,
                "name": "mean",
                "calls": [
                  "built-in"
                ]
              }
            ]
          }
        }
      }
    },
    ".meta": {
      "timing": 1
    }
  }
}
```



</details>
</li>
</ol>

The complete round-trip took 21.77 ms (including time required to validate the messages, start, and stop the internal mock server).

</details>


	

<hr>

<details>
<summary style="color:gray">Message schema (<code>request-query</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-query.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-query.ts).

- **.** object 
    _Request a query to be run on the file analysis information._
    - **type** string [required]
        _The type of the message._
        Allows only the values: 'request-query'
    - **id** string [optional]
        _If you give the id, the response will be sent to the client with the same id._
    - **filetoken** string [required]
        _The filetoken of the file/data retrieved from the analysis request._
    - **query** array [required]
        _The query to run on the file analysis information._
    Valid item types:
        - **.** alternatives 
            _Any query_
            - **.** alternatives 
                _Supported queries_
                - **.** object 
                    _Call context query used to find calls in the dataflow graph_
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'call-context'
                    - **callName** string [required]
                        _Regex regarding the function name!_
                    - **callNameExact** boolean [optional]
                        _Should we automatically add the `^` and `$` anchors to the regex to make it an exact match?_
                    - **kind** string [optional]
                        _The kind of the call, this can be used to group calls together (e.g., linking `plot` to `visualize`). Defaults to `.`_
                    - **subkind** string [optional]
                        _The subkind of the call, this can be used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`). Defaults to `.`_
                    - **callTargets** string [optional]
                        _Call targets the function may have. This defaults to `any`. Request this specifically to gain all call targets we can resolve._
                        Allows only the values: 'global', 'must-include-global', 'local', 'must-include-local', 'any'
                    - **includeAliases** boolean [optional]
                        _Consider a case like `f <- function_of_interest`, do you want uses of `f` to be included in the results?_
                    - **linkTo** object [optional]
                        _Links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc._
                        - **type** string [required]
                            _The type of the linkTo sub-query._
                            Allows only the values: 'link-to-last-call'
                        - **callName** string [required]
                            _Regex regarding the function name of the last call. Similar to `callName`, strings are interpreted as a regular expression._
                - **.** object 
                    _The dataflow query simply returns the dataflow graph, there is no need to pass it multiple times!_
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'dataflow'
                - **.** object 
                    _The id map query retrieves the id map from the normalized AST._
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'id-map'
                - **.** object 
                    _The normalized AST query simply returns the normalized AST, there is no need to pass it multiple times!_
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'normalized-ast'
                - **.** object 
                    _The cluster query calculates and returns all clusters in the dataflow graph._
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'dataflow-cluster'
                - **.** object 
                    _Slice query used to slice the dataflow graph_
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'static-slice'
                    - **criteria** array [required]
                        _The slicing criteria to use._
                    Valid item types:
                        - **.** string 
                    - **noReconstruction** boolean [optional]
                        _Do not reconstruct the slice into readable code._
                    - **noMagicComments** boolean [optional]
                        _Should the magic comments (force-including lines within the slice) be ignored?_
                - **.** object 
                    _Lineage query used to find the lineage of a node in the dataflow graph_
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'lineage'
                    - **criterion** string [required]
                        _The slicing criterion of the node to get the lineage of._
                - **.** object 
                    _The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data._
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'dependencies'
                    - **ignoreDefaultFunctions** boolean [optional]
                        _Should the set of functions that are detected by default be ignored/skipped?_
                    - **libraryFunctions** array [optional]
                        _The set of library functions to search for._
                    Valid item types:
                        - **.** object 
                            - **name** string [required]
                                _The name of the library function._
                            - **argIdx** number [optional]
                                _The index of the argument that contains the library name._
                            - **argName** string [optional]
                                _The name of the argument that contains the library name._
                    - **sourceFunctions** array [optional]
                        _The set of source functions to search for._
                    Valid item types:
                        - **.** object 
                            - **name** string [required]
                                _The name of the library function._
                            - **argIdx** number [optional]
                                _The index of the argument that contains the library name._
                            - **argName** string [optional]
                                _The name of the argument that contains the library name._
                    - **readFunctions** array [optional]
                        _The set of data reading functions to search for._
                    Valid item types:
                        - **.** object 
                            - **name** string [required]
                                _The name of the library function._
                            - **argIdx** number [optional]
                                _The index of the argument that contains the library name._
                            - **argName** string [optional]
                                _The name of the argument that contains the library name._
                    - **writeFunctions** array [optional]
                        _The set of data writing functions to search for._
                    Valid item types:
                        - **.** object 
                            - **name** string [required]
                                _The name of the library function._
                            - **argIdx** number [optional]
                                _The index of the argument that contains the library name._
                            - **argName** string [optional]
                                _The name of the argument that contains the library name._
                - **.** object 
                    _The id map query retrieves the location of every id in the ast._
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'location-map'
            - **.** alternatives 
                _Virtual queries (used for structure)_
                - **.** object 
                    _Compound query used to combine queries of the same type_
                    - **type** string [required]
                        _The type of the query._
                        Allows only the values: 'compound'
                    - **query** string [required]
                        _The query to run on the file analysis information._
                    - **commonArguments** object [required]
                        _Common arguments for all queries._
                    - **arguments** array [required]
                        _Arguments for each query._
                    Valid item types:
                        - **.** object 

</details>

<details>
<summary style="color:gray">Message schema (<code>response-query</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-query.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-query.ts).

- **.** object 
    _The response to a query request._
    - **type** string [required]
        Allows only the values: 'response-query'
    - **id** string [optional]
        _The id of the message, will be the same for the request._
    - **results** object [required]
        _The results of the query._

</details>



<hr>

</details>	
	</li>

<li>
<a id="message-request-lineage"></a>
<b>Lineage</b> Message (<code>request-lineage</code>) 
<details>

<summary style="color:gray"> View Details. <i>(<a href="https://github.com/flowr-analysis/flowr/wiki//Query%20API">deprecated</a>) Obtain the lineage of a given slicing criterion.</i> </summary>

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server

    
    Client->>+Server: request-lineage

    alt
        Server-->>Client: response-lineage
    else
        Server-->>Client: error
    end
    deactivate  Server
	
```



**We deprecated the lineage request in favor of the `lineage` [Query](https://github.com/flowr-analysis/flowr/wiki//Query%20API).**

In order to retrieve the lineage of an object, you have to send a file analysis request first. The `filetoken` you assign is of use here as you can re-use it to repeatedly retrieve the lineage of the same file.
Besides that, you will need to add a [criterion](https://github.com/flowr-analysis/flowr/wiki//Terminology#slicing-criterion) that specifies the object whose lineage you're interested in.


<details>
<summary>Example of the <code>request-query</code> Message</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

<ol>
<li> <code>hello</code> (response)
<details> 

<summary> Show Details </summary>

The first message is always a hello message.




```json
{
  "type": "hello",
  "clientName": "client-0",
  "versions": {
    "flowr": "2.1.5",
    "r": "4.4.0"
  }
}
```



</details>
</li>

<li> <code>request-file-analysis</code> (request)
<details> 

<summary> Show Details </summary>






```json
{
  "type": "request-file-analysis",
  "id": "1",
  "filetoken": "x",
  "content": "x <- 1\nx + 1"
}
```



</details>
</li>

<li> <code>response-file-analysis</code> (response)
<details> 

<summary> Show Details </summary>


See [above](#message-request-file-analysis) for the general structure of the response.
			


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"type":"response-file-analysis","format":"json","id":"1","results":{"parse":{"parsed":"[1,1,1,6,7,0,\"expr\",false,\"x <- 1\"],[1,1,1,1,1,3,\"SYMBOL\",true,\"x\"],[1,1,1,1,3,7,\"expr\",false,\"x\"],[1,3,1,4,2,7,\"LEFT_ASSIGN\",true,\"<-\"],[1,6,1,6,4,5,\"NUM_CONST\",true,\"1\"],[1,6,1,6,5,7,\"expr\",false,\"1\"],[2,1,2,5,16,0,\"expr\",false,\"x + 1\"],[2,1,2,1,10,12,\"SYMBOL\",true,\"x\"],[2,1,2,1,12,16,\"expr\",false,\"x\"],[2,3,2,3,11,16,\"'+'\",true,\"+\"],[2,5,2,5,13,14,\"NUM_CONST\",true,\"1\"],[2,5,2,5,14,16,\"expr\",false,\"1\"]",".meta":{"timing":2}},"normalize":{"ast":{"type":"RExpressionList","children":[{"type":"RBinaryOp","location":[1,3,1,4],"lhs":{"type":"RSymbol","location":[1,1,1,1],"content":"x","lexeme":"x","info":{"fullRange":[1,1,1,1],"additionalTokens":[],"id":0,"parent":2,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-kzlK1oQUyrvK-.R"}},"rhs":{"location":[1,6,1,6],"lexeme":"1","info":{"fullRange":[1,6,1,6],"additionalTokens":[],"id":1,"parent":2,"role":"binop-rhs","index":1,"nesting":0,"file":"/tmp/tmp-5406-kzlK1oQUyrvK-.R"},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"operator":"<-","lexeme":"<-","info":{"fullRange":[1,1,1,6],"additionalTokens":[],"id":2,"parent":6,"nesting":0,"file":"/tmp/tmp-5406-kzlK1oQUyrvK-.R","index":0,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[2,3,2,3],"lhs":{"type":"RSymbol","location":[2,1,2,1],"content":"x","lexeme":"x","info":{"fullRange":[2,1,2,1],"additionalTokens":[],"id":3,"parent":5,"role":"binop-lhs","index":0,"nesting":0,"file":"/tmp/tmp-5406-kzlK1oQUyrvK-.R"}},"rhs":{"location":[2,5,2,5],"lexeme":"1","info":{"fullRange":[2,5,2,5],"additionalTokens":[],"id":4,"parent":5,"role":"binop-rhs","index":1,"nesting":0,"file":"/tmp/tmp-5406-kzlK1oQUyrvK-.R"},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"operator":"+","lexeme":"+","info":{"fullRange":[2,1,2,5],"additionalTokens":[],"id":5,"parent":6,"nesting":0,"file":"/tmp/tmp-5406-kzlK1oQUyrvK-.R","index":1,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":6,"nesting":0,"file":"/tmp/tmp-5406-kzlK1oQUyrvK-.R","role":"root","index":0}},".meta":{"timing":0}},"dataflow":{"unknownReferences":[],"in":[{"nodeId":2,"name":"<-","type":2},{"nodeId":5,"name":"+","type":2}],"out":[{"nodeId":0,"name":"x","type":4,"definedAt":2}],"environment":{"current":{"id":200,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["pdf",[{"type":128,"definedAt":"built-in","name":"pdf","nodeId":"built-in"}]],["jpeg",[{"type":128,"definedAt":"built-in","name":"jpeg","nodeId":"built-in"}]],["png",[{"type":128,"definedAt":"built-in","name":"png","nodeId":"built-in"}]],["windows",[{"type":128,"definedAt":"built-in","name":"windows","nodeId":"built-in"}]],["postscript",[{"type":128,"definedAt":"built-in","name":"postscript","nodeId":"built-in"}]],["xfig",[{"type":128,"definedAt":"built-in","name":"xfig","nodeId":"built-in"}]],["bitmap",[{"type":128,"definedAt":"built-in","name":"bitmap","nodeId":"built-in"}]],["pictex",[{"type":128,"definedAt":"built-in","name":"pictex","nodeId":"built-in"}]],["cairo_pdf",[{"type":128,"definedAt":"built-in","name":"cairo_pdf","nodeId":"built-in"}]],["svg",[{"type":128,"definedAt":"built-in","name":"svg","nodeId":"built-in"}]],["bmp",[{"type":128,"definedAt":"built-in","name":"bmp","nodeId":"built-in"}]],["tiff",[{"type":128,"definedAt":"built-in","name":"tiff","nodeId":"built-in"}]],["X11",[{"type":128,"definedAt":"built-in","name":"X11","nodeId":"built-in"}]],["quartz",[{"type":128,"definedAt":"built-in","name":"quartz","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["message",[{"type":128,"definedAt":"built-in","name":"message","nodeId":"built-in"}]],["warning",[{"type":128,"definedAt":"built-in","name":"warning","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["plot.new",[{"type":128,"definedAt":"built-in","name":"plot.new","nodeId":"built-in"}]],["curve",[{"type":128,"definedAt":"built-in","name":"curve","nodeId":"built-in"}]],["map",[{"type":128,"definedAt":"built-in","name":"map","nodeId":"built-in"}]],["image",[{"type":128,"definedAt":"built-in","name":"image","nodeId":"built-in"}]],["boxplot",[{"type":128,"definedAt":"built-in","name":"boxplot","nodeId":"built-in"}]],["dotchart",[{"type":128,"definedAt":"built-in","name":"dotchart","nodeId":"built-in"}]],["sunflowerplot",[{"type":128,"definedAt":"built-in","name":"sunflowerplot","nodeId":"built-in"}]],["barplot",[{"type":128,"definedAt":"built-in","name":"barplot","nodeId":"built-in"}]],["matplot",[{"type":128,"definedAt":"built-in","name":"matplot","nodeId":"built-in"}]],["hist",[{"type":128,"definedAt":"built-in","name":"hist","nodeId":"built-in"}]],["stem",[{"type":128,"definedAt":"built-in","name":"stem","nodeId":"built-in"}]],["density",[{"type":128,"definedAt":"built-in","name":"density","nodeId":"built-in"}]],["smoothScatter",[{"type":128,"definedAt":"built-in","name":"smoothScatter","nodeId":"built-in"}]],["contour",[{"type":128,"definedAt":"built-in","name":"contour","nodeId":"built-in"}]],["persp",[{"type":128,"definedAt":"built-in","name":"persp","nodeId":"built-in"}]],["points",[{"type":128,"definedAt":"built-in","name":"points","nodeId":"built-in"}]],["abline",[{"type":128,"definedAt":"built-in","name":"abline","nodeId":"built-in"}]],["mtext",[{"type":128,"definedAt":"built-in","name":"mtext","nodeId":"built-in"}]],["lines",[{"type":128,"definedAt":"built-in","name":"lines","nodeId":"built-in"}]],["text",[{"type":128,"definedAt":"built-in","name":"text","nodeId":"built-in"}]],["legend",[{"type":128,"definedAt":"built-in","name":"legend","nodeId":"built-in"}]],["title",[{"type":128,"definedAt":"built-in","name":"title","nodeId":"built-in"}]],["axis",[{"type":128,"definedAt":"built-in","name":"axis","nodeId":"built-in"}]],["polygon",[{"type":128,"definedAt":"built-in","name":"polygon","nodeId":"built-in"}]],["polypath",[{"type":128,"definedAt":"built-in","name":"polypath","nodeId":"built-in"}]],["pie",[{"type":128,"definedAt":"built-in","name":"pie","nodeId":"built-in"}]],["rect",[{"type":128,"definedAt":"built-in","name":"rect","nodeId":"built-in"}]],["segments",[{"type":128,"definedAt":"built-in","name":"segments","nodeId":"built-in"}]],["arrows",[{"type":128,"definedAt":"built-in","name":"arrows","nodeId":"built-in"}]],["symbols",[{"type":128,"definedAt":"built-in","name":"symbols","nodeId":"built-in"}]],["tiplabels",[{"type":128,"definedAt":"built-in","name":"tiplabels","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["x",[{"nodeId":0,"name":"x","type":4,"definedAt":2}]]]},"level":0},"graph":{"_unknownSideEffects":[],"rootVertices":[1,0,2,3,4,5],"vertexInformation":[[1,{"tag":"value","id":1}],[0,{"tag":"variable-definition","id":0}],[2,{"tag":"function-call","id":2,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":0,"type":32},{"nodeId":1,"type":32}]}],[3,{"tag":"use","id":3}],[4,{"tag":"value","id":4}],[5,{"tag":"function-call","id":5,"name":"+","onlyBuiltin":true,"args":[{"nodeId":3,"type":32},{"nodeId":4,"type":32}]}]],"edgeInformation":[[2,[[1,{"types":64}],[0,{"types":72}]]],[0,[[1,{"types":2}],[2,{"types":2}]]],[3,[[0,{"types":1}]]],[5,[[3,{"types":65}],[4,{"types":65}]]]]},"entryPoint":2,"exitPoints":[{"type":0,"nodeId":5}],".meta":{"timing":0}}}}
```



</details>
</li>

<li> <b><code>request-lineage</code> (request)</b>
<details open> 

<summary> Show Details </summary>






```json
{
  "type": "request-lineage",
  "id": "2",
  "filetoken": "x",
  "criterion": "2@x"
}
```



</details>
</li>

<li> <code>response-lineage</code> (response)
<details> 

<summary> Show Details </summary>

The response contains the lineage of the desired object in form of an array of IDs (as the representation of a set).




```json
{
  "type": "response-lineage",
  "id": "2",
  "lineage": [
    3,
    0,
    1,
    2
  ]
}
```



</details>
</li>
</ol>

The complete round-trip took 4.11 ms (including time required to validate the messages, start, and stop the internal mock server).

</details>


	

<hr>

<details>
<summary style="color:gray">Message schema (<code>request-lineage</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-lineage.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-lineage.ts).

- **.** object 
    - **type** string [required]
        _The type of the message._
        Allows only the values: 'request-lineage'
    - **id** string [optional]
        _If you give the id, the response will be sent to the client with the same id._
    - **filetoken** string [required]
        _The filetoken of the file/data retrieved from the analysis request._
    - **criterion** string [required]
        _The criterion to start the lineage from._

</details>

<details>
<summary style="color:gray">Message schema (<code>response-lineage</code>)</summary>

For the definition of the hello message, please see it's implementation at [`./src/cli/repl/server/messages/message-lineage.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/cli/repl/server/messages/message-lineage.ts).

- **.** object 
    - **type** string [required]
        Allows only the values: 'response-lineage'
    - **id** string [optional]
        _The id of the message, will be the same for the request._
    - **lineage** array [required]
        _The lineage of the given criterion._
    Valid item types:
        - **.** string 

</details>



<hr>

</details>	
	</li>

</ul>

### 📡 Ways of Connecting

If you are interested in clients that communicate with _flowR_, please check out the [R adapter](https://github.com/flowr-analysis/flowr-r-adapter)
as well as the [Visual Studio Code extension](https://github.com/flowr-analysis/vscode-flowr). 

<ol>

<li>
<a id="using-netcat-without-websocket"></a>Using Netcat

<details>

<summary>Without Websocket</summary>

Suppose, you want to launch the server using a docker container. Then, start the server by (forwarding the internal default port):


```shell
docker run -p1042:1042 -it --rm eagleoutice/flowr --server
```


Now, using a tool like [_netcat_](https://linux.die.net/man/1/nc) to connect:


```shell
nc 127.0.0.1 1042
```


Within the started session, type the following message (as a single line) and press enter to see the response:


```json
{"type":"request-file-analysis","content":"x <- 1","id":"1"}
```


</details>
</li>

<li> Using Python
<details>
<summary>Without Websocket</summary>

In Python, a similar process would look like this. After starting the server as with using [netcat](#using-netcat-without-websocket), you can use the following script to connect:


```python
import socket

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.connect(('127.0.0.1', 1042))
    print(s.recv(4096))  # for the hello message

    s.send(b'{"type":"request-file-analysis","content":"x <- 1","id":"1"}\n')

    print(s.recv(65536))  # for the response (please use a more sophisticated mechanism)
```


</details>
</li>

</ol>



<a id='using-the-repl'></a>
## 💻 Using the REPL


> [!NOTE]
> To execute arbitrary R commands with a repl request, _flowR_ has to be started explicitly with <span title="Description (Command Line Argument): Allow to access the underlying R session when using flowR (security warning: this allows the execution of arbitrary R code!)">`--r-session-access`</span>.
> Please be aware that this introduces a security risk.


Although primarily meant for users to explore, 
there is nothing which forbids simply calling _flowR_ as a subprocess to use standard-in, -output, and -error 
for communication (although you can access the REPL using the server as well, 
with the [REPL Request](#message-request-repl-execution) message).

The read-eval-print loop&nbsp;(REPL) works relatively simple.
You can submit an expression (using enter),
which is interpreted as an R&nbsp;expression by default but interpreted as a *command* if it starts with a colon (`:`).
The best command to get started with the REPL is <span title="Description (Repl Command): Show help information (aliases: :h, :?)">`:help`</span>.
Besides, you can leave the REPL either with the command <span title="Description (Repl Command): End the repl (aliases: :q, :exit)">`:quit`</span> or by pressing <kbd>CTRL</kbd>+<kbd>C</kbd> twice.


<details>
<summary>Available Commands</summary>

We currently offer the following commands (this with a `[*]` suffix are available with and without the star):


| Command | Description |
| ------- | ----------- |
| **<span title="Description (Repl Command): End the repl (aliases: :q, :exit)">:quit</span>** | End the repl (aliases: **:<span title="Alias of ':quit'. End the repl">q</span>**, **:<span title="Alias of ':quit'. End the repl">exit</span>**) |
| **<span title="Description (Repl Command): Execute the given code as R code (essentially similar to using now command) (aliases: :e, :r)">:execute</span>** | Execute the given code as R code (essentially similar to using now command) (aliases: **:<span title="Alias of ':execute'. Execute the given code as R code (essentially similar to using now command)">e</span>**, **:<span title="Alias of ':execute'. Execute the given code as R code (essentially similar to using now command)">r</span>**) |
| **<span title="Description (Repl Command): Get mermaid code for the control-flow graph of R code, start with 'file://' to indicate a file (aliases: :cfg, :cf)">:controlflow[*]</span>** | Get mermaid code for the control-flow graph of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (aliases: **:<span title="Alias of ':controlflow'. Get mermaid code for the control-flow graph of R code, start with 'file://' to indicate a file">cfg</span>**, **:<span title="Alias of ':controlflow'. Get mermaid code for the control-flow graph of R code, start with 'file://' to indicate a file">cf</span>**) |
| **<span title="Description (Repl Command): Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file (aliases: :d, :df)">:dataflow[*]</span>** | Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (aliases: **:<span title="Alias of ':dataflow'. Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file">d</span>**, **:<span title="Alias of ':dataflow'. Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file">df</span>**) |
| **<span title="Description (Repl Command): Get mermaid code for the normalized AST of R code, start with 'file://' to indicate a file (aliases: :n)">:normalize[*]</span>** | Get mermaid code for the normalized AST of R code, start with 'file://' to indicate a file (star: Returns the URL to mermaid.live) (alias: **:<span title="Alias of ':normalize'. Get mermaid code for the normalized AST of R code, start with 'file://' to indicate a file">n</span>**) |
| **<span title="Description (Repl Command): Get the lineage of an R object (aliases: :lin)">:lineage</span>** | Get the lineage of an R object (alias: **:<span title="Alias of ':lineage'. Get the lineage of an R object">lin</span>**) |
| **<span title="Description (Repl Command): Prints ASCII Art of the parsed, unmodified AST, start with 'file://' to indicate a file (aliases: :p)">:parse</span>** | Prints ASCII Art of the parsed, unmodified AST, start with 'file://' to indicate a file (alias: **:<span title="Alias of ':parse'. Prints ASCII Art of the parsed, unmodified AST, start with 'file://' to indicate a file">p</span>**) |
| **<span title="Description (Repl Command): Prints the version of flowR as well as the current version of R">:version</span>** | Prints the version of flowR as well as the current version of R
| **<span title="Description (Repl Command): Query the given R code, start with 'file://' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information).">:query[*]</span>** | Query the given R code, start with 'file://' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information). (star: Similar to query, but returns the output in json format.)
| **<span title="Description (Repl Command): Show help information (aliases: :h, :?)">:help</span>** | Show help information (aliases: **:<span title="Alias of ':help'. Show help information">h</span>**, **:<span title="Alias of ':help'. Show help information">?</span>**) |


</details>


### Example: Retrieving the Dataflow Graph

To retrieve a URL to the [mermaid](https://mermaid.js.org/) diagram of the dataflow of a given expression, 
use <span title="Description (Repl Command, starred version): Returns the URL to mermaid.live; Base Command: Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file (aliases: :d*, :df*)">`:dataflow*`</span> (or <span title="Description (Repl Command): Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file (aliases: :d, :df)">`:dataflow`</span> to get the mermaid code in the cli):



```shell
docker run -it --rm eagleoutice/flowr
R> :dataflow* y <- 1 + x
```

<details>
<summary style='color:gray'>Output</summary>

Retrieve the dataflow graph of the expression `y <- 1 + x`. It looks like this:



```mermaid
flowchart LR
    1{{"`#91;RNumber#93; 1
      (1)
      *1.6*`"}}
    2(["`#91;RSymbol#93; x
      (2)
      *1.10*`"])
    3[["`#91;RBinaryOp#93; #43;
      (3)
      *1.6-10*
    (1, 2)`"]]
    0["`#91;RSymbol#93; y
      (0)
      *1.1*`"]
    4[["`#91;RBinaryOp#93; #60;#45;
      (4)
      *1.1-10*
    (0, 3)`"]]
    3 -->|"reads, argument"| 1
    3 -->|"reads, argument"| 2
    0 -->|"defined-by"| 3
    0 -->|"defined-by"| 4
    4 -->|"argument"| 3
    4 -->|"returns, argument"| 0
```
	
<details>

<summary style="color:gray">R Code of the Dataflow Graph</summary>

The analysis required _1.86 ms_ (incl. parse and normalize) within the generation environment. 
We encountered no unknown side effects during the analysis.

```r
y <- 1 + x
```

<details>

<summary style="color:gray">Mermaid Code </summary>

```
flowchart LR
    1{{"`#91;RNumber#93; 1
      (1)
      *1.6*`"}}
    2(["`#91;RSymbol#93; x
      (2)
      *1.10*`"])
    3[["`#91;RBinaryOp#93; #43;
      (3)
      *1.6-10*
    (1, 2)`"]]
    0["`#91;RSymbol#93; y
      (0)
      *1.1*`"]
    4[["`#91;RBinaryOp#93; #60;#45;
      (4)
      *1.1-10*
    (0, 3)`"]]
    3 -->|"reads, argument"| 1
    3 -->|"reads, argument"| 2
    0 -->|"defined-by"| 3
    0 -->|"defined-by"| 4
    4 -->|"argument"| 3
    4 -->|"returns, argument"| 0
```

</details>

</details>

.


```text
https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgIzkxO1JOdW1iZXIjOTM7IDFcbiAgICAgICgxKVxuICAgICAgKjEuNipgXCJ9fVxuICAgIDIoW1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoMilcbiAgICAgICoxLjEwKmBcIl0pXG4gICAgM1tbXCJgIzkxO1JCaW5hcnlPcCM5MzsgIzQzO1xuICAgICAgKDMpXG4gICAgICAqMS42LTEwKlxuICAgICgxLCAyKWBcIl1dXG4gICAgMFtcImAjOTE7UlN5bWJvbCM5MzsgeVxuICAgICAgKDApXG4gICAgICAqMS4xKmBcIl1cbiAgICA0W1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDQpXG4gICAgICAqMS4xLTEwKlxuICAgICgwLCAzKWBcIl1dXG4gICAgMyAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgMVxuICAgIDMgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDJcbiAgICAwIC0tPnxcImRlZmluZWQtYnlcInwgM1xuICAgIDAgLS0+fFwiZGVmaW5lZC1ieVwifCA0XG4gICAgNCAtLT58XCJhcmd1bWVudFwifCAzXG4gICAgNCAtLT58XCJyZXR1cm5zLCBhcmd1bWVudFwifCAwIiwibWVybWFpZCI6eyJhdXRvU3luYyI6dHJ1ZX19
```


</details>



For the slicing with <span title="Description (Repl Command): Static backwards executable slicer for R">`:slicer`</span>, you have access to the same [magic comments](#slice-magic-comments) as with the [slice request](#message-request-slice).

### Example: Interfacing with the File System

Many commands that allow for an R-expression (like <span title="Description (Repl Command, starred version): Returns the URL to mermaid.live; Base Command: Get mermaid code for the dataflow graph of R code, start with 'file://' to indicate a file (aliases: :d*, :df*)">`:dataflow*`</span>) allow for a file as well 
if the argument starts with `file://`. 
If you are working from the root directory of the _flowR_ repository, the following gives you the parsed AST of the example file using the <span title="Description (Repl Command): Prints ASCII Art of the parsed, unmodified AST, start with 'file://' to indicate a file (aliases: :p)">`:parse`</span> command:



```shell
docker run -it --rm eagleoutice/flowr
R> :parse file://test/testfiles/example.R
```

<details>
<summary style='color:gray'>Output</summary>

Retrieve the parsed AST of the example file.

<details>

<summary>File Content</summary>	


```r
sum <- 0
product <- 1
w <- 7
N <- 10

for (i in 1:(N-1)) {
  sum <- sum + i + w
  product <- product * i
}

cat("Sum:", sum, "\n")
cat("Product:", product, "\n")
```


</details>

As _flowR_ directly transforms this AST the output focuses on being human-readable instead of being machine-readable. 
		


```text
exprlist
├ expr
│ ├ expr
│ │ ╰ SYMBOL "sum" (1:1─1:3)
│ ├ LEFT_ASSIGN "<-" (1:5─1:6)
│ ╰ expr
│   ╰ NUM_CONST "0" (1:8)
├ expr
│ ├ expr
│ │ ╰ SYMBOL "product" (2:1─2:7)
│ ├ LEFT_ASSIGN "<-" (2:9─2:10)
│ ╰ expr
│   ╰ NUM_CONST "1" (2:12)
├ expr
│ ├ expr
│ │ ╰ SYMBOL "w" (3:1)
│ ├ LEFT_ASSIGN "<-" (3:3─3:4)
│ ╰ expr
│   ╰ NUM_CONST "7" (3:6)
├ expr
│ ├ expr
│ │ ╰ SYMBOL "N" (4:1)
│ ├ LEFT_ASSIGN "<-" (4:3─4:4)
│ ╰ expr
│   ╰ NUM_CONST "10" (4:6─4:7)
├ expr
│ ├ FOR "for" (6:1─6:3)
│ ├ forcond
│ │ ├ ( "(" (6:5)
│ │ ├ SYMBOL "i" (6:6)
│ │ ├ IN "in" (6:8─6:9)
│ │ ├ expr
│ │ │ ├ expr
│ │ │ │ ╰ NUM_CONST "1" (6:11)
│ │ │ ├ : ":" (6:12)
│ │ │ ╰ expr
│ │ │   ├ ( "(" (6:13)
│ │ │   ├ expr
│ │ │   │ ├ expr
│ │ │   │ │ ╰ SYMBOL "N" (6:14)
│ │ │   │ ├ - "-" (6:15)
│ │ │   │ ╰ expr
│ │ │   │   ╰ NUM_CONST "1" (6:16)
│ │ │   ╰ ) ")" (6:17)
│ │ ╰ ) ")" (6:18)
│ ╰ expr
│   ├ { "{" (6:20)
│   ├ expr
│   │ ├ expr
│   │ │ ╰ SYMBOL "sum" (7:3─7:5)
│   │ ├ LEFT_ASSIGN "<-" (7:7─7:8)
│   │ ╰ expr
│   │   ├ expr
│   │   │ ├ expr
│   │   │ │ ╰ SYMBOL "sum" (7:10─7:12)
│   │   │ ├ + "+" (7:14)
│   │   │ ╰ expr
│   │   │   ╰ SYMBOL "i" (7:16)
│   │   ├ + "+" (7:18)
│   │   ╰ expr
│   │     ╰ SYMBOL "w" (7:20)
│   ├ expr
│   │ ├ expr
│   │ │ ╰ SYMBOL "product" (8:3─8:9)
│   │ ├ LEFT_ASSIGN "<-" (8:11─8:12)
│   │ ╰ expr
│   │   ├ expr
│   │   │ ╰ SYMBOL "product" (8:14─8:20)
│   │   ├ * "*" (8:22)
│   │   ╰ expr
│   │     ╰ SYMBOL "i" (8:24)
│   ╰ } "}" (9:1)
├ expr
│ ├ expr
│ │ ╰ SYMBOL_FUNCTION_CALL "cat" (11:1─11:3)
│ ├ ( "(" (11:4)
│ ├ expr
│ │ ╰ STR_CONST "\"Sum:\"" (11:5─11:10)
│ ├ , "," (11:11)
│ ├ expr
│ │ ╰ SYMBOL "sum" (11:13─11:15)
│ ├ , "," (11:16)
│ ├ expr
│ │ ╰ STR_CONST "\"\\n\"" (11:18─11:21)
│ ╰ ) ")" (11:22)
╰ expr
  ├ expr
  │ ╰ SYMBOL_FUNCTION_CALL "cat" (12:1─12:3)
  ├ ( "(" (12:4)
  ├ expr
  │ ╰ STR_CONST "\"Product:\"" (12:5─12:14)
  ├ , "," (12:15)
  ├ expr
  │ ╰ SYMBOL "product" (12:17─12:23)
  ├ , "," (12:24)
  ├ expr
  │ ╰ STR_CONST "\"\\n\"" (12:26─12:29)
  ╰ ) ")" (12:30)
```


</details>




<a id='configuring-flowr'></a>
## ⚙️ Configuring FlowR



When running _flowR_, you may want to specify some behaviors with a dedicated configuration file. 
By default, flowR looks for a file named `flowr.json` in the current working directory (or any higher directory). 
You can also specify a different file with <span title="Description (Command Line Argument): The name of the configuration file to use">`--config-file`</span> or pass the configuration inline using <span title="Description (Command Line Argument): The flowR configuration to use, as a JSON string">`--config-json`</span>.

The following summarizes the configuration options:


- `ignoreSourceCalls`: If set to `true`, _flowR_ will ignore source calls when analyzing the code, i.e., ignoring the inclusion of other files.
- `rPath`: The path to the R executable. If not set, _flowR_ will try to find the R executable in the system's PATH.
- `semantics`: allows to configure the way _flowR_ handles R, although we currently only support `semantics/environment/overwriteBuiltIns`. 
  You may use this to overwrite _flowR_'s handling of built-in function and even completely clear the preset definitions shipped with flowR. 
  See [Configure BuiltIn Semantics](#configure-builtin-semantics) for more information.

So you can configure _flowR_ by adding a file like the following:

<details>

<summary>Example Configuration File</summary>


```json
{
  "ignoreSourceCalls": true,
  "rPath": "/usr/bin/R",
  "semantics": {
    "environment": {
      "overwriteBuiltIns": {
        "definitions": [
          {
            "type": "function",
            "names": [
              "foo"
            ],
            "processor": "builtin:assignment",
            "config": {}
          }
        ]
      }
    }
  }
}
```


</details>

<details> 
<a id='configure-builtin-semantics'></a>
<summary>Configure Built-In Semantics</summary> 


`semantics/environment/overwriteBuiltins` accepts two keys:

- `loadDefaults` (boolean, initially `true`): If set to `true`, the default built-in definitions are loaded before applying the custom definitions. Setting this flag to `false` explicitly disables the loading of the default definitions.
- `definitions` (array, initially empty): Allows to overwrite or define new built-in elements. Each object within must have a `type` which is one of the below. Furthermore, they may define a string array of `names` which specifies the identifiers to bind the definitions to. You may use `assumePrimitive` to specify whether _flowR_ should assume that this is a primitive non-library definition (so you probably just do not want to specify the key).

  | Type          | Description                                                                                                                                                                                                                                                                                              | Example                                                                                                    |
  | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | `constant`    | Additionally allows for a `value` this should resolve to.                                                                                                                                                                                                                                                | `{ type: 'constant', names: ['NULL', 'NA'],  value: null }`                                                |
  | `function`    | Is a rather flexible way to define and bind built-in functions. For the time, we do not have extensive documentation to cover all the cases, so please either consult the sources with the `default-builtin-config.ts` or open a [new issue](https://github.com/flowr-analysis/flowr/issues/new/choose). | `{ type: 'function', names: ['next'], processor: 'builtin:default', config: { cfg: ExitPointType.Next } }` |
  | `replacement` | A comfortable way to specify replacement functions like `$<-` or `names<-`. `suffixes` describes the... suffixes to attach automatically. | `{ type: 'replacement', suffixes: ['<-', '<<-'], names: ['[', '[['] }` |


</details>

<details>

<summary style='color:gray'>Full Configuration-File Schema</summary>

- **.** object 
    _The configuration file format for flowR._
    - **ignoreSourceCalls** boolean [optional]
        _Whether source calls should be ignored, causing {@link processSourceCall}'s behavior to be skipped._
    - **rPath** string [optional]
        _The path to the R executable to use. If this is undefined, this uses the default path._
    - **semantics** object 
        _Configure language semantics and how flowR handles them._
        - **environment** object [optional]
            _Semantics regarding the handlings of the environment._
            - **overwriteBuiltIns** object [optional]
                _Do you want to overwrite (parts) of the builtin definition?_
                - **loadDefaults** boolean [optional]
                    _Should the default configuration still be loaded?_
                - **definitions** array [optional]
                    _The definitions to load/overwrite._
                Valid item types:
                    - **.** object 

</details>

	

<a id='writing-code'></a>
## ⚒️ Writing Code




_flowR_ can be used as a [module](https://www.npmjs.com/package/@eagleoutice/flowr) and offers several main classes and interfaces that are interesting for extension writers 
(see the [Visual Studio Code extension](https://github.com/flowr-analysis/vscode-flowr) or the [core](https://github.com/flowr-analysis/flowr/wiki//Core) wiki page for more information).

### Using the `RShell` to Interact with R

The `RShell` class allows to interface with the `R`&nbsp;ecosystem installed on the host system.
For now there are no (real) alternatives, although we plan on providing more flexible drop-in replacements.

> [!IMPORTANT]
> Each `RShell` controls a new instance of the R&nbsp;interpreter, make sure to call `RShell::close()` when you’re done.

You can start a new "session" simply by constructing a new object with `new RShell()`.

However, there are several options which may be of interest (e.g., to automatically revive the shell in case of errors or to control the name location of the R process on the system).

With a shell object (let's call it `shell`), you can execute R code by using `RShell::sendCommand`, 
for example `shell.sendCommand("1 + 1")`. 
However, this does not return anything, so if you want to collect the output of your command, use `RShell::sendCommandWithOutput` instead.

Besides that, the command `RShell::tryToInjectHomeLibPath` may be of interest, as it enables all libraries available on the host system.

### The Pipeline Executor

Once, in the beginning, _flowR_ was meant to produce a dataflow graph merely to provide *program slices*. 
However, with continuous updates, the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki//Dataflow&20Graph) repeatedly proves to be the more interesting part.
With this, we restructured _flowR_'s originally *hardcoded* pipeline to be far more flexible. 
Now, it can be theoretically extended or replaced with arbitrary steps, optional steps, and what we call 'decorations' of these steps. 
In short, if you still "just want to slice" you can do it like this:


```ts
const slicer = new PipelineExecutor(DEFAULT_SLICING_PIPELINE, {
  shell:     new RShell(),
  request:   requestFromInput('x <- 1\nx + 1'),
  criterion: ['2@x']
})
const slice = await slicer.allRemainingSteps()
// console.log(slice.reconstruct.code)
```


<details>

<summary style='color:gray'>More Information</summary>

If you compare this, with what you would have done with the old (and removed) `SteppingSlicer`, 
this essentially just requires you to replace the `SteppingSlicer` with the `PipelineExecutor` 
and to pass the `DEFAULT_SLICING_PIPELINE` as the first argument.
The `PipelineExecutor`...

1. allows investigating the results of all intermediate steps
2. Can be executed step-by-step
3. Can repeat steps (e.g., to calculate multiple slices on the same input)

See the in-code documentation for more information.

</details>

### Generate Statistics


<details>

<summary>Adding a New Feature to Extract</summary>

In this example, we construct a new feature to extract, with the name "*example*".
Whenever this name appears, you may substitute this with whatever name fits your feature best (as long as the name is unique).

1. **Create a new file in `src/statistics/features/supported`**\
   Create the file `example.ts`, and add its export to the `index.ts` file in the same directory (if not done automatically).

2. **Create the basic structure**\
   To get a better feel of what a feature must have, let's look
   at the basic structure (of course, due to TypeScript syntax,
   there are other ways to achieve the same goal):

   ```ts
   const initialExampleInfo = {
       /* whatever start value is good for you */
       someCounter: 0
   }

   export type ExampleInfo = Writable<typeof initialExampleInfo>

   export const example: Feature<ExampleInfo> = {
    name:        'Example Feature',
    description: 'A longer example description',

    process(existing: ExampleInfo, input: FeatureProcessorInput): ExampleInfo {
      /* perform analysis on the input */
      return existing
    },

    initialValue: initialExampleInfo
   }
   ```

   The `initialExampleInfo` type holds the initial values for each counter that you want to maintain during the feature extraction (they will usually be initialized with 0). The resulting `ExampleInfo` type holds the structure of the data that is to be counted. Due to the vast amount of data processed, information like the name and location of a function call is not stored here, but instead written to disk (see below).

   Every new feature must be of the `Feature<Info>` type, with `Info` referring to a `FeatureInfo` (like `ExampleInfo` in this example). Next to a `name` and a `description`, each Feature must provide:

   - a processor that extracts the information from the input, adding it to the existing information.
   - a function returning the initial value of the information (in this case, `initialExampleInfo`).

3. **Add it to the feature-mapping**\
   Now, in the `feature.ts` file in `src/statistics/features`, add your feature to the `ALL_FEATURES` object.

Now, we want to extract something. For the *example* feature created in the previous steps, we choose to count the amount of `COMMENT` tokens.
So we define a corresponding [XPath](https://developer.mozilla.org/en-US/docs/Web/XPath) query:

```ts
const commentQuery: Query = xpath.parse('//COMMENT')
```

Within our feature's `process` function, running the query is as simple as:

```ts
const comments = commentQuery.select({ node: input.parsedRAst })
```

Now we could do a lot of further processing, but for simplicity, we only record every comment found this way:

```ts
appendStatisticsFile(example.name, 'comments', comments, input.filepath)
```

We use `example.name` to avoid duplication with the name that we’ve assigned to the feature. It corresponds to the name of the folder in the statistics output.
`'comments'` refers to a freely chosen (but unique) name, that will be used as the name for the output file within the folder. The `comments` variable holds the result of the query, which is an array of nodes. Finally, we pass the `filepath` of the file that was analyzed (if known), so that it can be added to the statistics file (as additional information).

</details>
	


