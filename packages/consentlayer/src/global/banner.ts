import type { ConsentController, ConsentControllerActions } from '../core/consent-controller'

const defaultText = {
  title: 'Cookies',
  message: 'We use cookies to run this site and, with your consent, for preferences, analytics and marketing.',
  privacyPolicy: 'Privacy policy',
  gpc: "Your browser's Global Privacy Control signal is on, so marketing is off unless you switch it on.",
  rejectNonEssential: 'Reject non-essential',
  customize: 'Customize',
  acceptAll: 'Accept all',
  settingsTitle: 'Cookie settings',
  necessaryLabel: 'Necessary',
  necessaryDescription: 'Needed for the site to work, such as remembering this choice. Always on.',
  preferencesLabel: 'Preferences',
  preferencesDescription: 'Remember settings such as language or region.',
  analyticsLabel: 'Analytics',
  analyticsDescription: 'Help us understand how the site is used.',
  marketingLabel: 'Marketing',
  marketingDescription: 'Measure our ads and show relevant ones on other sites.',
  close: 'Close',
  save: 'Save',
}

/** `window.ConsentLayer.banner`. `text` also takes `<category>Label` and `<category>Description` for custom categories. */
export type BannerConfig = {
  privacyPolicyUrl?: string
  text?: Partial<typeof defaultText> & Record<string, string>
}

const css = `
.consentlayer-banner,.consentlayer-dialog[open]{display:grid;gap:.75rem;box-sizing:border-box;padding:1.25rem;
border:1px solid var(--consentlayer-border,#e5e7eb);border-radius:var(--consentlayer-radius,.75rem);
background:var(--consentlayer-background,#fff);color:var(--consentlayer-color,#111827);
box-shadow:0 10px 30px rgb(0 0 0/.12);font:var(--consentlayer-font,.95rem/1.45 system-ui,sans-serif)}
.consentlayer-banner{position:fixed;z-index:var(--consentlayer-z-index,1000);inset:auto 1rem 1rem;max-width:40rem;margin-inline:auto}
.consentlayer-banner[hidden]{display:none}
.consentlayer-dialog{width:min(30rem,calc(100vw - 2rem))}
.consentlayer-dialog::backdrop{background:var(--consentlayer-backdrop,rgb(0 0 0/.3))}
.consentlayer-banner h2,.consentlayer-dialog h2{margin:0;color:inherit;font-size:1.1rem}
.consentlayer-banner p{margin:0}
.consentlayer-banner a{color:inherit}
.consentlayer-dialog label{display:flex;gap:.6rem;align-items:start}
.consentlayer-dialog input{margin-top:.3rem;accent-color:var(--consentlayer-accent,#111827)}
.consentlayer-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.5rem}
.consentlayer-actions button{padding:.5rem .9rem;border:1px solid var(--consentlayer-border,#e5e7eb);
border-radius:var(--consentlayer-button-radius,.5rem);background:transparent;color:inherit;font:inherit;cursor:pointer}
.consentlayer-actions .consentlayer-primary{border-color:var(--consentlayer-accent,#111827);
background:var(--consentlayer-accent,#111827);color:var(--consentlayer-accent-color,#fff)}
.consentlayer-banner :focus-visible,.consentlayer-dialog :focus-visible{outline:2px solid var(--consentlayer-accent,#111827);outline-offset:2px}`

/** Merges `window.ConsentLayer.banner` with the banner script's `data-privacy-policy-url` and `data-text-*` attributes; an attribute wins. */
export function readBannerConfig(
  global: BannerConfig | undefined,
  script: HTMLOrSVGScriptElement | null,
): BannerConfig {
  const text: Record<string, string> = { ...global?.text }
  let privacyPolicyUrl = global?.privacyPolicyUrl
  const dataset = script instanceof HTMLScriptElement ? script.dataset : {}
  for (const [key, value] of Object.entries(dataset)) {
    if (value === undefined) continue
    if (key === 'privacyPolicyUrl') privacyPolicyUrl = value
    else if (/^text[A-Z]/.test(key)) text[key[4].toLowerCase() + key.slice(5)] = value
  }
  return { privacyPolicyUrl, text }
}

function element(tag: string, attributes: Record<string, string> = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  node.append(...children)
  return node
}

/** Renders the banner and the settings dialog from `controller`'s state. Returns a function that removes them. */
export function mountBanner(
  controller: ConsentController,
  { privacyPolicyUrl, text: overrides }: BannerConfig = {},
  nonce = '',
) {
  const text: typeof defaultText & Record<string, string | undefined> = { ...defaultText, ...overrides }
  const button = (label: string, action: Exclude<keyof ConsentControllerActions, 'setPrefs'>, primary = false) => {
    const node = element('button', { type: 'button', ...(primary && { class: 'consentlayer-primary' }) }, label)
    node.addEventListener('click', () => void controller.actions[action]())
    return node
  }
  const actions = (...buttons: HTMLElement[]) => element('div', { class: 'consentlayer-actions' }, ...buttons)
  const row = (label: string, description: string, input: HTMLInputElement) =>
    element('label', {}, input, element('span', {}, element('strong', {}, label), ` ${description}`))

  const style = element('style', nonce ? { nonce } : {}, css)
  const banner = element(
    'section',
    { class: 'consentlayer-banner', role: 'dialog', 'aria-labelledby': 'consentlayer-banner-title', hidden: '' },
    element('h2', { id: 'consentlayer-banner-title' }, text.title),
    element(
      'p',
      {},
      text.message,
      ...(privacyPolicyUrl ? [' ', element('a', { href: privacyPolicyUrl }, text.privacyPolicy)] : []),
    ),
    ...(controller.getSnapshot().gpc ? [element('p', { class: 'consentlayer-gpc' }, text.gpc)] : []),
    actions(
      button(text.rejectNonEssential, 'rejectNonEssential'),
      button(text.customize, 'openDialog'),
      button(text.acceptAll, 'acceptAll', true),
    ),
  )
  const necessary = element('input', { type: 'checkbox', checked: '', disabled: '' }) as HTMLInputElement
  const list = element('div', { class: 'consentlayer-categories' })
  const dialog = element(
    'dialog',
    { class: 'consentlayer-dialog', 'aria-labelledby': 'consentlayer-dialog-title' },
    element('h2', { id: 'consentlayer-dialog-title' }, text.settingsTitle),
    row(text.necessaryLabel, text.necessaryDescription, necessary),
    list,
    actions(button(text.close, 'closeDialog'), button(text.save, 'savePreferences', true)),
  ) as HTMLDialogElement

  const renderCategories = () => {
    const { categories, prefs } = controller.getSnapshot()
    list.replaceChildren(
      ...categories.map((category) => {
        const input = element('input', { type: 'checkbox' }) as HTMLInputElement
        input.checked = prefs[category]
        input.addEventListener('change', () =>
          controller.actions.setPrefs({ ...controller.getSnapshot().prefs, [category]: input.checked }),
        )
        return row(text[`${category}Label`] ?? category, text[`${category}Description`] ?? '', input)
      }),
    )
  }
  const render = () => {
    const { ready, bannerVisible, dialogVisible } = controller.getSnapshot()
    banner.hidden = !ready || !bannerVisible
    if (dialogVisible && !dialog.open) {
      renderCategories()
      dialog.showModal()
    }
    if (!dialogVisible && dialog.open) dialog.close()
  }

  dialog.addEventListener('close', () => controller.actions.closeDialog())
  document.head.append(style)
  document.body.prepend(banner, dialog)
  const unsubscribe = controller.subscribe(render)
  render()
  return () => {
    unsubscribe()
    style.remove()
    banner.remove()
    dialog.remove()
  }
}

const script = document.currentScript
const start = () => {
  const global = window.ConsentLayer
  if (!global || !('controller' in global)) addEventListener('consentlayer:ready', start, { once: true })
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else mountBanner(global.controller, readBannerConfig(global.banner, script), script?.nonce)
}
start()
