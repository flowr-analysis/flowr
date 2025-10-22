name: Linting Rule
description: Suggest either a new linting rule or an improvement to an existing one. 
title: "[Linter]: "
labels: ["flowr linter"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for suggesting a new linting rule or an improvement to an existing one. Please provide as much detail as possible to help us understand your request. See the [Linter Wiki Page](https://github.com/flowr-analysis/flowr/wiki/Linter) for more information.
  - type: textarea
    id: description
    attributes:
      label: Description
      description: |
        Please provide a detailed description of the linting rule you are suggesting or the improvement you would like to see. Include examples if possible.
    validations:
      required: true
  - type: dropdown
    id: linting-rule
    attributes:
      label: Linting Rule
      description: |
        Select the linting rule that you are suggesting or improving. If it is a new rule, select "New Rule".
      options:
        - New Rule
        - Absolute Paths
        - Dataframe Access Validation
        - Dead Code
        - Deprecated Functions
        - File Path Validity
        - Naming Convention
        - Network Functions
        - Seeded Randomness
        - Unused Definitions
        - Useless Loops
      default: 0
  - type: checkboxes
    id: tags
    attributes:
      label: Meta Information
      description: Select any tags that you think apply to the linting rule you are suggesting. If you try to suggest a new linting rule, please only select those that you think apply after your suggestions.
      options:
        - label: '**Bug**: This rule is used to detect bugs in the code. Every…'
          required: false
        - label: '**Deprecated**: This signals the use of deprecated functions or fea…'
          required: false
        - label: '**Documentation**: This rule is used to detect issues that are related…'
          required: false
        - label: '**Experimental**: This marks rules which are currently considered exp…'
          required: false
        - label: '**Performance**: This rule is used to detect issues that are related…'
          required: false
        - label: '**Robustness**: This rule is used to detect issues that are related…'
          required: false
        - label: '**Rver3**: The rule is specific to R version 3.x.'
          required: false
        - label: '**Rver4**: The rule is specific to R version 4.x.'
          required: false
        - label: '**Readability**: This rule is used to detect issues that are related…'
          required: false
        - label: '**Reproducibility**: This rule is used to detect issues that are related…'
          required: false
        - label: '**Security**: This rule is used to detect security-critical. For …'
          required: false
        - label: '**Shiny**: This rule is used to detect issues that are related…'
          required: false
        - label: '**Smell**: This rule is used to detect issues that do not dire…'
          required: false
        - label: '**Style**: This rule is used to detect issues that are related…'
          required: false
        - label: '**Usability**: This rule is used to detect issues that are related…'
          required: false
        - label: '**QuickFix**: This rule may provide quickfixes to automatically f…'
          required: false
