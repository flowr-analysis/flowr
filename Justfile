eval:
    #!/usr/bin/env sh
    npm run flowr -- -e ":slicer -r \"eval(parse(paste(\\\"x <- \\\", \\\"5\\\",sep=\\\"\\\")));\n42\" --criterion 2@42"
