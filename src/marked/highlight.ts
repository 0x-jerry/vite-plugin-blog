// modify based on https://github.com/jGleitz/markdown-it-prism
import { MarkedExtension } from 'marked'
import Prism, { Grammar } from 'prismjs'
import loadLanguages from 'prismjs/components/'

interface Options {
  /**
   * Prism plugins to load.
   */
  plugins: string[]
  /**
   * Callback for Prism initialisation. Useful for initialising plugins.
   * @param prism The Prism instance that will be used by the plugin.
   */
  init: (prism: typeof Prism) => void
  /**
   * The language to use for code blocks that specify a language that Prism does not know.
   */
  defaultLanguageForUnknown?: string
  /**
   * The language to use for code blocks that do not specify a language.
   */
  defaultLanguageForUnspecified?: string
  /**
   * Shorthand to set both {@code defaultLanguageForUnknown} and {@code defaultLanguageForUnspecified} to the same value. Will be copied
   * to each option if it is set to {@code undefined}.
   */
  defaultLanguage?: string
}

const DEFAULTS: Options = {
  plugins: [],
  init: () => {
    // do nothing by default
  },
  defaultLanguageForUnknown: undefined,
  defaultLanguageForUnspecified: undefined,
  defaultLanguage: undefined,
}

/**
 * Loads the provided `lang` into prism.
 *
 * @param lang
 *        Code of the language to load.
 * @return The Prism language object for the provided {@code lang} code. {@code undefined} if the language is not known to Prism.
 */
function loadPrismLang(lang: string): Grammar | undefined {
  if (!lang) return undefined
  let langObject = Prism.languages[lang]
  if (langObject === undefined) {
    loadLanguages([lang])
    langObject = Prism.languages[lang]
  }
  return langObject
}

/**
 * Loads the provided Prism plugin.
 * @param name
 *        Name of the plugin to load.
 * @throws {Error} If there is no plugin with the provided `name`.
 */
function loadPrismPlugin(name: string): void {
  try {
    require(`prismjs/plugins/${name}/prism-${name}`)
  } catch (e) {
    throw new Error(`Cannot load Prism plugin "${name}". Please check the spelling.`)
  }
}

/**
 * Select the language to use for highlighting, based on the provided options and the specified language.
 *
 * @param options
 *        The options that were used to initialise the plugin.
 * @param lang
 *        Code of the language to highlight the text in.
 * @return The name of the language to use and the Prism language object for that language.
 */
function selectLanguage(options: Options, lang: string): [string, Grammar | undefined] {
  let langToUse = lang
  if (langToUse === '' && options.defaultLanguageForUnspecified !== undefined) {
    langToUse = options.defaultLanguageForUnspecified
  }
  let prismLang = loadPrismLang(langToUse)
  if (prismLang === undefined && options.defaultLanguageForUnknown !== undefined) {
    langToUse = options.defaultLanguageForUnknown
    prismLang = loadPrismLang(langToUse)
  }
  return [langToUse, prismLang]
}

/**
 * Checks whether an option represents a valid Prism language
 *
 * @param options
 *        The options that have been used to initialise the plugin.
 * @param optionName
 *        The key of the option inside {@code options} that shall be checked.
 * @throws {Error} If the option is not set to a valid Prism language.
 */
function checkLanguageOption(
  options: Options,
  optionName: 'defaultLanguage' | 'defaultLanguageForUnknown' | 'defaultLanguageForUnspecified'
): void {
  const language = options[optionName]
  if (language !== undefined && loadPrismLang(language) === undefined) {
    throw new Error(`Bad option ${optionName}: There is no Prism language '${language}'.`)
  }
}

/**
 * Initialisation function of the plugin.
 *
 * @param useroptions
 *        The options this plugin is being initialised with.
 */
export function highlightExt(useroptions: Partial<Options> = {}): MarkedExtension {
  const options = Object.assign({}, DEFAULTS, useroptions)

  checkLanguageOption(options, 'defaultLanguage')
  checkLanguageOption(options, 'defaultLanguageForUnknown')
  checkLanguageOption(options, 'defaultLanguageForUnspecified')
  options.defaultLanguageForUnknown = options.defaultLanguageForUnknown || options.defaultLanguage
  options.defaultLanguageForUnspecified =
    options.defaultLanguageForUnspecified || options.defaultLanguage

  options.plugins.forEach(loadPrismPlugin)
  options.init(Prism)

  return {
    renderer: {
      code(text, lang = '') {
        const result = highlight(options, text, lang)
        const [langToUse] = selectLanguage(options, lang)

        return `<pre class="language-${langToUse}">${result}</pre>`
      },
    },
  }
}

/**
 * Highlights the provided text using Prism.
 *
 * @param options
 *        The options that have been used to initialise the plugin.
 * @param text
 *        The text to highlight.
 * @param lang
 *        Code of the language to highlight the text in.
 * @return If Prism knows the language that {@link selectLanguage} returns for `lang`, the `text` highlighted for that language. Otherwise, `text`
 *  html-escaped.
 */
function highlight(options: Options, text: string, lang: string): string {
  const [langToUse, prismLang] = selectLanguage(options, lang)
  return prismLang ? Prism.highlight(text, prismLang, langToUse) : text
}
