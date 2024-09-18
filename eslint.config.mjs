import globals from "globals";
import js from "@eslint/js";
import tse from "typescript-eslint";
import tsep from "@typescript-eslint/eslint-plugin";
import edp from "eslint-plugin-tsdoc"
import euip from "eslint-plugin-unused-imports";
import cfp from "eslint-plugin-check-file";
import sjp from "@stylistic/eslint-plugin";

export default [
{
    files: ["**/*.ts"],
    "settings": {
        "import/resolver": {
            "node": {
                "extensions": [
                    ".ts"
                ]
            }
        }
    },
    "ignores": [],
/*    "extends": [
        "@eagleoutice/eslint-config-flowr"
    ],*/
    "rules": {}
},/* -------------- */
    js.configs.recommended,
    ...tse.configs.strictTypeChecked,
    ...tse.configs.stylisticTypeChecked,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: "module",
            globals: {
                ...globals.node,
            },
            parserOptions: {
                projectService: true
            }
        },
        "plugins": {
            "@typescript-eslint": tsep,
            "tsdoc": edp,
            "unused-imports": euip,
            "check-file": cfp,
            "@stylistic": sjp
        },
        "rules": {
            "@stylistic/object-curly-spacing": [
                "error",
                "always"
            ],
            "@stylistic/indent": [
                "error",
                "tab",
                {
                    "FunctionDeclaration": {
                        "parameters": "first"
                    },
                    "ObjectExpression": 1,
                    "SwitchCase": 1
                }
            ],
            "@stylistic/quotes": [
                "error",
                "single",
                {
                    "avoidEscape": true
                }
            ],
            "@stylistic/no-mixed-spaces-and-tabs": [
                "error",
                "smart-tabs"
            ],
            "no-warning-comments": [
                "error",
                {
                    "terms": [
                        "todo",
                        "fixme",
                        "xxx"
                    ],
                    "location": "anywhere"
                }
            ],
            "@typescript-eslint/non-nullable-type-assertion-style": "off",
            "@typescript-eslint/no-unsafe-enum-comparison": "off",
            "@typescript-eslint/no-redundant-type-constituents": "off",
            "@typescript-eslint/consistent-type-assertions": [
                "error",
                {
                    "assertionStyle": "as"
                }
            ],
            "@stylistic/key-spacing": [
                "error",
                {
                    "align": "value"
                }
            ],
            "@stylistic/semi": [
                "error",
                "always",
                {
                    "omitLastInOneLineBlock": true
                }
            ],
            "check-file/filename-naming-convention": [
                "error",
                {
                    "**/*.ts": "?(\\d+-)?([A-Z])+([a-z])*((-|.)?([A-Z])+([a-z]))"
                }
            ],
            "check-file/folder-match-with-fex": [
                "error",
                {
                    "*.spec.{js,jsx,ts,tsx}": "test/**"
                }
            ],
            "@stylistic/keyword-spacing": [
                "error",
                {
                    "before": true,
                    "after": true,
                    "overrides": {
                        "if": {
                            "after": false
                        },
                        "for": {
                            "after": false
                        },
                        "while": {
                            "after": false
                        },
                        "do": {
                            "after": false
                        },
                        "catch": {
                            "after": false
                        },
                        "switch": {
                            "after": false
                        },
                        "default": {
                            "after": false
                        },
                        "throw": {
                            "after": false
                        }
                    }
                }
            ],
            "@stylistic/space-before-function-paren": [
                "error",
                "never"
            ],
            "@typescript-eslint/no-unused-vars": "off",
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "error",
                {
                    "vars": "all",
                    "varsIgnorePattern": "^_",
                    "args": "after-used",
                    "argsIgnorePattern": "^_",
                },
            ],
            "tsdoc/syntax": "error",
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    "selector": "variable",
                    "modifiers": [
                        "const",
                        "global",
                        "exported"
                    ],
                    "format": [
                        "camelCase",
                        "PascalCase",
                        "UPPER_CASE"
                    ],
                    "leadingUnderscore": "allow",
                    "trailingUnderscore": "allow"
                },
                {
                    "selector": "variable",
                    "modifiers": [
                        "const"
                    ],
                    "format": [
                        "camelCase",
                        "PascalCase"
                    ],
                    "leadingUnderscore": "allow",
                    "trailingUnderscore": "allow"
                },
                {
                    "selector": "enumMember",
                    "format": [
                        "StrictPascalCase"
                    ],
                    "leadingUnderscore": "forbid",
                    "trailingUnderscore": "forbid"
                },
                {
                    "selector": "typeLike",
                    "format": [
                        "PascalCase"
                    ]
                }
            ],
            "@typescript-eslint/consistent-type-imports": "error",
            "curly": "error",
            "@stylistic/brace-style": [
                "error",
                "1tbs"
            ],
            "@stylistic/new-parens": "error"
        }
    }]
