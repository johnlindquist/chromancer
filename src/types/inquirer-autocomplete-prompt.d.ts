declare module 'inquirer-autocomplete-prompt' {
  import { Question } from 'inquirer'
  
  interface AutocompleteQuestionOptions extends Question {
    type: 'autocomplete'
    source: (answersSoFar: any, input: string) => Promise<string[]>
    pageSize?: number
    searchText?: string
    emptyText?: string
  }
  
  const AutocompletePrompt: any
  export default AutocompletePrompt
}