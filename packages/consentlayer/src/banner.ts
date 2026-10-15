import type { ConsentController, ConsentControllerActions } from './core/consent-controller'

const defaultText = {
  title: 'Cookies',
  message: 'We use cookies to run this site and, with your consent, for preferences, analytics and marketing.',
  privacyPolicy: 'Privacy policy',
  cookiePolicy: 'Cookie policy',
  terms: 'Terms of service',
  gpc: "Your browser's Global Privacy Control signal is on, so marketing is off unless you switch it on.",
  rejectNonEssential: 'Reject non-essential',
  dismiss: 'Continue without accepting',
  customize: 'Customize',
  acceptAll: 'Accept all',
  settingsTitle: 'Cookie settings',
  settingsMessage: '',
  necessaryLabel: 'Necessary',
  necessaryDescription: 'Needed for the site to work, such as remembering this choice. Always on.',
  preferencesLabel: 'Preferences',
  preferencesDescription: 'Remember settings such as language or region.',
  analyticsLabel: 'Analytics',
  analyticsDescription: 'Help us understand how the site is used.',
  marketingLabel: 'Marketing',
  marketingDescription: 'Measure our ads and show relevant ones on other sites.',
  close: 'Close',
  save: 'Save choices',
  badge: 'Cookie settings',
}

type BannerPart =
  | 'banner'
  | 'title'
  | 'message'
  | 'actions'
  | 'rejectNonEssential'
  | 'dismiss'
  | 'customize'
  | 'acceptAll'
  | 'dialog'
  | 'settingsTitle'
  | 'settingsMessage'
  | 'category'
  | 'close'
  | 'save'
  | 'badge'

type Edge = 'top' | 'bottom'
type Side = 'left' | 'center' | 'right'

export type BannerOptions = {
  /** `top` and `bottom` span the page as a bar; the others float as a card. Defaults to `bottom-left`. */
  position?: Edge | `${Edge}-${Side}` | 'center'
  /** Dims the page behind the banner. */
  overlay?: boolean
  /** Keeps the page from being used until the visitor chooses. */
  blocking?: boolean
  /** `equal` gives Reject and Accept the same weight; `accept` fills only Accept. Defaults to `equal`. */
  emphasis?: 'equal' | 'accept'
  /** Adds an × in the corner that rejects non-essential categories, labelled with the `dismiss` text. */
  closeButton?: boolean
  /** The button that reopens the settings once the banner is gone, or `false` for none. */
  badge?:
    | false
    | {
        /** Defaults to `after-choice`. */
        show?: 'after-choice' | 'always'
        /** Defaults to `bottom-left`. */
        position?: `${Edge}-${Side}` | 'left' | 'right'
        /** Shows the `badge` text next to the icon. */
        label?: boolean
        /** Sits flush against the nearest edge, the side edge for a corner. */
        attached?: boolean
      }
  privacyPolicyUrl?: string
  cookiePolicyUrl?: string
  termsUrl?: string
  /**
   * Each text may use `[label](url)`, `**bold**` and the `{privacyPolicy}`, `{cookiePolicy}` and `{terms}` placeholders.
   * A link whose placeholder is not in `message` follows it. Also takes `<category>Label` and `<category>Description`
   * for custom categories.
   */
  text?: Partial<typeof defaultText> & Record<string, string>
  /** Classes added to each part, such as Tailwind utilities. */
  classNames?: Partial<Record<BannerPart, string>>
  /** Leaves out the built-in stylesheet. */
  unstyled?: boolean
  /** For the built-in `<style>` element under a Content Security Policy. */
  nonce?: string
}

const css = `@layer components.consentlayer{
:where(.consentlayer-banner,.consentlayer-dialog){display:grid;gap:.75rem;box-sizing:border-box;padding:1.25rem;
border:1px solid var(--consentlayer-border,rgb(128 128 128/.3));border-radius:var(--consentlayer-radius,.75rem);
background:var(--consentlayer-background,Canvas);color:var(--consentlayer-color,CanvasText);
box-shadow:0 10px 30px rgb(0 0 0/.15);font:var(--consentlayer-font,inherit);overflow-wrap:break-word}
:where(.consentlayer-banner,.consentlayer-badge){margin:0;position:fixed;z-index:var(--consentlayer-z-index,1000)}
:where(.consentlayer-banner,.consentlayer-badge)[hidden]{display:none!important}
:where(dialog.consentlayer-banner:not([open]),.consentlayer-dialog:not([open])){display:none}
:where(.consentlayer-close){position:absolute;top:.25rem;right:.25rem;display:grid;place-items:center;width:2.5rem;height:2.5rem;padding:0;
border:0;border-radius:var(--consentlayer-button-radius,.5rem);background:none;color:inherit;font:inherit;font-size:1.75rem;line-height:1;opacity:.6;cursor:pointer}
:where(.consentlayer-close:focus-visible){opacity:1}
:where(.consentlayer-banner[data-close],.consentlayer-dialog) :where(h2){margin-right:2.5rem}
:where(.consentlayer-banner){inset:auto;max-width:none;max-height:calc(100% - 2rem);overflow:auto}
:where(.consentlayer-banner[data-layout=bar]){width:auto;max-height:100%}
:where(.consentlayer-banner[data-layout=card]){inset:auto;width:min(28rem,calc(100vw - 2rem))}
:where(.consentlayer-banner,.consentlayer-badge):where([data-position^=top]){top:1rem}
:where(.consentlayer-banner,.consentlayer-badge):where([data-position^=bottom]){bottom:1rem}
:where(.consentlayer-banner,.consentlayer-badge):where([data-position$=left]){left:1rem}
:where(.consentlayer-banner,.consentlayer-badge):where([data-position$=right]){right:1rem}
:where(.consentlayer-banner[data-position$=-center]){left:0;right:0;margin-inline:auto}
:where(.consentlayer-banner[data-layout=card]):where([data-position$=center]){width:min(40rem,calc(100vw - 2rem))}
:where(.consentlayer-banner[data-position=center]){inset:0;height:fit-content;margin:auto}
:where(.consentlayer-banner[data-layout=bar]){left:0;right:0;border-radius:0}
:where(.consentlayer-banner[data-position=top]){top:0;border-width:0 0 1px}
:where(.consentlayer-banner[data-position=bottom]){bottom:0;border-width:1px 0 0}
:where(.consentlayer-dialog){position:fixed;inset:0;margin:auto;width:min(30rem,calc(100vw - 2rem));height:fit-content;max-height:calc(100% - 2rem);overflow:auto}
:where(.consentlayer-dialog)::backdrop{background:var(--consentlayer-backdrop,rgb(0 0 0/.3))}
:where(.consentlayer-banner)::backdrop{background:none}
:where(.consentlayer-banner[data-overlay]){box-shadow:0 0 0 100vmax var(--consentlayer-backdrop,rgb(0 0 0/.3))}
:where(.consentlayer-banner,.consentlayer-dialog) :where(h2){margin:0;color:inherit;font-size:1.1em;font-weight:700}
:where(.consentlayer-banner,.consentlayer-dialog) :where(p){margin:0}
:where(.consentlayer-banner) :where(a){color:inherit;text-decoration:underline;text-underline-offset:.15em}
:where(.consentlayer-dialog) :where(label){display:flex;gap:1rem;align-items:center;justify-content:space-between;padding-block:.75rem;
border-top:1px solid var(--consentlayer-border,rgb(128 128 128/.3))}
:where(.consentlayer-categories){display:grid}
:where(.consentlayer-dialog) :where(label>span){display:grid;gap:.15rem}
:where(.consentlayer-dialog) :where(small){font-size:.875em;opacity:.7}
:where(.consentlayer-dialog) :where(input){appearance:none;flex:none;position:relative;width:2.25rem;height:1.25rem;margin:0;border-radius:1rem;
background:rgb(128 128 128/.45);cursor:pointer;transition:background-color .15s}
:where(.consentlayer-dialog) :where(input)::before{content:'';position:absolute;top:.125rem;left:.125rem;width:1rem;height:1rem;border-radius:50%;
background:var(--consentlayer-accent-color,Canvas)}
:where(.consentlayer-dialog) :where(input:checked){background:var(--consentlayer-accent,CanvasText)}
:where(.consentlayer-dialog) :where(input:checked)::before{transform:translateX(1rem)}
:where(.consentlayer-dialog) :where(input:disabled){opacity:.5;cursor:not-allowed}
@media (prefers-reduced-motion:no-preference){
:where(.consentlayer-banner:not([hidden]),.consentlayer-dialog[open]){animation:consentlayer-in .2s ease-out}
:where(.consentlayer-banner,.consentlayer-dialog){transition:opacity .2s,translate .2s,display .2s allow-discrete,overlay .2s allow-discrete}
:where(.consentlayer-banner[hidden],.consentlayer-banner:not(section,[open]),.consentlayer-dialog:not([open])){opacity:0;translate:0 var(--consentlayer-shift,.5rem)}
:where(.consentlayer-banner[data-position^=top]){--consentlayer-shift:-.5rem}
:where(.consentlayer-dialog[open])::backdrop{animation:consentlayer-fade .2s ease-out}
:where(.consentlayer-dialog)::backdrop{transition:opacity .2s,display .2s allow-discrete,overlay .2s allow-discrete}
:where(.consentlayer-dialog:not([open]))::backdrop{opacity:0}
:where(.consentlayer-dialog) :where(input)::before{transition:transform .15s}
:where(.consentlayer-badge:not([hidden])){animation:consentlayer-pop .2s ease-out}
:where(.consentlayer-badge){transition:opacity .2s,scale .2s,display .2s allow-discrete}
:where(.consentlayer-badge[hidden]){opacity:0;scale:.8}}
@keyframes consentlayer-pop{from{opacity:0;scale:.8}}
@keyframes consentlayer-in{from{opacity:0;translate:0 var(--consentlayer-shift,.5rem)}}
@keyframes consentlayer-fade{from{opacity:0}}
:where(.consentlayer-actions){display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr));gap:.5rem}
:where(.consentlayer-banner[data-layout=card]:not([data-position$=center]),.consentlayer-dialog) :where(.consentlayer-more){grid-column:1/-1}
:where(.consentlayer-actions) :where(button),:where(.consentlayer-badge){padding:.5rem .9rem;border:1px solid var(--consentlayer-accent,CanvasText);
border-radius:var(--consentlayer-button-radius,.5rem);background:var(--consentlayer-accent,CanvasText);
color:var(--consentlayer-accent-color,Canvas);font:inherit;cursor:pointer}
:where(.consentlayer-actions) :where(button){transition:opacity .15s,background-color .15s}
:where(.consentlayer-actions) :where(.consentlayer-secondary){border-color:var(--consentlayer-border,rgb(128 128 128/.3));background:transparent;color:inherit}
@media (hover:hover){
:where(.consentlayer-close:hover){opacity:1}
:where(.consentlayer-actions) :where(button:hover),:where(.consentlayer-badge:hover){opacity:.85}
:where(.consentlayer-actions) :where(.consentlayer-secondary:hover){opacity:1;background:rgb(128 128 128/.12)}}
:where(html:has(.consentlayer-dialog[open],dialog.consentlayer-banner[open])){overflow:hidden}
:where(html[data-consentlayer-gutter]:has(.consentlayer-dialog[open],dialog.consentlayer-banner[open])){scrollbar-gutter:stable}
:where(.consentlayer-badge){z-index:calc(var(--consentlayer-z-index,1000) - 1);display:flex;align-items:center;gap:.4rem;padding:.6rem;border-radius:2rem;box-shadow:0 4px 12px rgb(0 0 0/.2);font:var(--consentlayer-font,inherit)}
:where(.consentlayer-badge) :where(svg){width:1.25rem;height:1.25rem;flex:none}
:where(.consentlayer-badge[data-position$=-center]){left:50%;transform:translateX(-50%)}
:where(.consentlayer-badge[data-position=left],.consentlayer-badge[data-position=right]){top:50%;transform:translateY(-50%)}
:where(.consentlayer-badge[data-position=left],.consentlayer-badge[data-attached][data-position$=-left]){left:0;border-radius:0 .5rem .5rem 0}
:where(.consentlayer-badge[data-position=right],.consentlayer-badge[data-attached][data-position$=-right]){right:0;border-radius:.5rem 0 0 .5rem}
:where(.consentlayer-badge[data-attached][data-position=top-center]){top:0;border-radius:0 0 .5rem .5rem}
:where(.consentlayer-badge[data-attached][data-position=bottom-center]){bottom:0;border-radius:.5rem .5rem 0 0}
:where(.consentlayer-badge[data-position=left],.consentlayer-badge[data-position=right]) :where(span){writing-mode:vertical-rl}
:where(.consentlayer-badge[data-position=left],.consentlayer-badge[data-position=right]):has(span){flex-direction:column}
:where(.consentlayer-banner,.consentlayer-dialog,.consentlayer-badge) :where(:focus-visible),:where(.consentlayer-badge:focus-visible){outline:2px solid var(--consentlayer-accent,CanvasText);outline-offset:2px}
@media (min-width:64rem){
:where(.consentlayer-banner[data-layout=bar]){grid-template-columns:1fr auto;align-items:center;padding-inline:max(1.25rem,calc(50vw - 36rem))}
:where(.consentlayer-banner[data-layout=bar]) :where(h2){display:none}
:where(.consentlayer-banner[data-layout=bar]) :where(.consentlayer-actions){grid-column:2;grid-row:1/span 2;grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:1fr}
:where(.consentlayer-banner[data-layout=bar][data-close]){padding-right:max(3.5rem,calc(50vw - 36rem))}}
@media (max-width:30rem){
:where(.consentlayer-actions){grid-template-columns:1fr}
:where(.consentlayer-banner[data-layout=card]){left:.5rem;right:.5rem;width:auto;margin-inline:0}
:where(.consentlayer-banner[data-layout=card][data-position^=top]){top:.5rem}
:where(.consentlayer-banner[data-layout=card][data-position^=bottom]){bottom:.5rem}}
@media (forced-colors:active){
:where(.consentlayer-actions) :where(button),:where(.consentlayer-badge){border-color:ButtonText;background:ButtonFace;color:ButtonText}
:where(.consentlayer-dialog) :where(input){forced-color-adjust:none;outline:1px solid CanvasText;background:Canvas}
:where(.consentlayer-dialog) :where(input)::before{background:CanvasText}
:where(.consentlayer-dialog) :where(input:checked){background:Highlight}
:where(.consentlayer-dialog) :where(input:checked)::before{background:HighlightText}}
@media print{:where(.consentlayer-banner,.consentlayer-badge){display:none}}}`

function element(tag: string, attributes: Record<string, string> = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  node.append(...children)
  return node
}

function icon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML =
    '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-5-5 4 4 0 0 1-4-4Z"/><g fill="currentColor"><circle cx="8.5" cy="10.5" r="1.3"/><circle cx="14" cy="15" r="1.3"/><circle cx="9" cy="16" r="1"/></g>'
  return svg
}

/** Renders the banner and the settings dialog from `controller`'s state. Returns a function that removes them. */
export function mountBanner(
  controller: Pick<ConsentController, 'actions' | 'getSnapshot' | 'subscribe'>,
  {
    position = 'bottom-left',
    overlay,
    blocking,
    closeButton,
    emphasis = 'equal',
    badge: badgeOptions = {},
    privacyPolicyUrl,
    cookiePolicyUrl,
    termsUrl,
    text: overrides,
    classNames = {},
    unstyled,
    nonce,
  }: BannerOptions = {},
) {
  const text: typeof defaultText & Record<string, string | undefined> = { ...defaultText, ...overrides }
  const urls = { privacyPolicy: privacyPolicyUrl, cookiePolicy: cookiePolicyUrl, terms: termsUrl }
  const link = (key: keyof typeof urls) =>
    urls[key] ? [element('a', { href: urls[key] }, ...content(text[key], true))] : content(text[key], true)
  const content = (value = '', nested = false): (Node | string)[] => {
    const nodes: (Node | string)[] = []
    let last = 0
    for (const match of value.matchAll(
      /\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\{(privacyPolicy|cookiePolicy|terms)\}/g,
    )) {
      const [whole, label, href, bold, key] = match
      nodes.push(value.slice(last, match.index))
      if (key) nodes.push(...(nested ? [whole] : link(key as keyof typeof urls)))
      else if (bold) nodes.push(element('strong', {}, ...content(bold, nested)))
      else if (!nested && /^(https?:|mailto:)|^[^:]*$/i.test(href))
        nodes.push(element('a', { href }, ...content(label, true)))
      else nodes.push(...content(label, nested))
      last = match.index + whole.length
    }
    nodes.push(value.slice(last))
    return nodes
  }
  const plain = (value: string) => element('span', {}, ...content(value)).textContent ?? ''
  const trailing = (Object.keys(urls) as (keyof typeof urls)[]).filter(
    (key) => urls[key] && !text.message.includes(`{${key}}`),
  )
  const className = (part: BannerPart, base = '') => ({
    class: [base, classNames[part]].filter(Boolean).join(' '),
  })
  const button = (
    action: Exclude<keyof ConsentControllerActions, 'setPrefs' | 'showBanner' | 'hideBanner'>,
    part: BannerPart,
    label: string,
    secondary = false,
  ) => {
    const node = element(
      'button',
      { type: 'button', ...className(part, secondary ? 'consentlayer-secondary' : '') },
      ...content(label),
    )
    node.addEventListener('click', () => void controller.actions[action]())
    return node
  }
  const more = (node: HTMLElement) => {
    node.classList.add('consentlayer-more')
    return node
  }
  const closer = (action: 'rejectNonEssential' | 'closeDialog', part: BannerPart, label: string) => {
    const node = button(action, part, '×')
    node.classList.add('consentlayer-close')
    node.setAttribute('aria-label', plain(label))
    node.title = plain(label)
    return node
  }
  const choices = () => [
    button('acceptAll', 'acceptAll', text.acceptAll),
    button('rejectNonEssential', 'rejectNonEssential', text.rejectNonEssential, emphasis === 'accept'),
  ]
  const actions = (...buttons: HTMLElement[]) =>
    element('div', className('actions', 'consentlayer-actions'), ...buttons)
  const row = (label: string, description: string | undefined, input: HTMLInputElement) => {
    input.setAttribute('role', 'switch')
    return element(
      'label',
      className('category'),
      element('span', {}, element('strong', {}, ...content(label)), ' ', element('small', {}, ...content(description))),
      input,
    )
  }

  const style = element('style', nonce ? { nonce } : {}, css)
  const banner = element(
    blocking ? 'dialog' : 'section',
    {
      ...className('banner', 'consentlayer-banner'),
      'data-layout': position === 'top' || position === 'bottom' ? 'bar' : 'card',
      'data-position': position,
      ...(overlay && { 'data-overlay': '' }),
      ...(closeButton && { 'data-close': '' }),
      'aria-labelledby': 'consentlayer-banner-title',
      ...(!blocking && { role: 'dialog', hidden: '' }),
    },
    element('h2', { id: 'consentlayer-banner-title', ...className('title') }, ...content(text.title)),
    element(
      'p',
      className('message'),
      ...content(text.message),
      ...trailing.flatMap((key, index) => [index ? ' · ' : ' ', ...link(key)]),
    ),
    ...(controller.getSnapshot().gpc ? [element('p', { class: 'consentlayer-gpc' }, ...content(text.gpc))] : []),
    ...(closeButton ? [closer('rejectNonEssential', 'dismiss', text.dismiss)] : []),
    actions(...choices(), more(button('openDialog', 'customize', text.customize, true))),
  )
  const necessary = element('input', { type: 'checkbox', checked: '', disabled: '' }) as HTMLInputElement
  const list = element('div', { class: 'consentlayer-categories' })
  const dialog = element(
    'dialog',
    { ...className('dialog', 'consentlayer-dialog'), 'aria-labelledby': 'consentlayer-dialog-title' },
    element('h2', { id: 'consentlayer-dialog-title', ...className('settingsTitle') }, ...content(text.settingsTitle)),
    ...(text.settingsMessage ? [element('p', className('settingsMessage'), ...content(text.settingsMessage))] : []),
    closer('closeDialog', 'close', text.close),
    row(text.necessaryLabel, text.necessaryDescription, necessary),
    list,
    actions(...choices(), more(button('savePreferences', 'save', text.save, true))),
  ) as HTMLDialogElement
  const badge = badgeOptions
    ? element(
        'button',
        {
          type: 'button',
          ...className('badge', 'consentlayer-badge'),
          'data-position': badgeOptions.position ?? 'bottom-left',
          ...(badgeOptions.attached && { 'data-attached': '' }),
          hidden: '',
          ...(!badgeOptions.label && { 'aria-label': plain(text.badge), title: plain(text.badge) }),
        },
        icon(),
        ...(badgeOptions.label ? [element('span', {}, ...content(text.badge))] : []),
      )
    : null
  badge?.addEventListener('click', () => controller.actions.openDialog())

  const switches = controller.getSnapshot().categories.map((category) => {
    const input = element('input', { type: 'checkbox' }) as HTMLInputElement
    input.addEventListener('change', () =>
      controller.actions.setPrefs({ ...controller.getSnapshot().prefs, [category]: input.checked }),
    )
    list.append(row(text[`${category}Label`] ?? category, text[`${category}Description`], input))
    return [category, input] as const
  })
  let opener: Element | null = null
  const root = document.documentElement
  const render = () => {
    const { ready, bannerVisible, dialogVisible, chosen, prefs } = controller.getSnapshot()
    const showBanner = ready && bannerVisible && !dialogVisible
    const focusInBanner = banner.contains(document.activeElement)
    if (!dialog.open && !(banner instanceof HTMLDialogElement && banner.open))
      root.toggleAttribute('data-consentlayer-gutter', innerWidth > root.clientWidth)
    for (const [category, input] of switches) input.checked = prefs[category]
    if (dialogVisible && !dialog.open) {
      opener = document.activeElement
      dialog.showModal()
    }
    if (banner instanceof HTMLDialogElement) {
      if (showBanner && !banner.open) banner.showModal()
      if (!showBanner && banner.open) banner.close()
    } else banner.hidden = !showBanner
    if (badge) badge.hidden = !ready || (badgeOptions && badgeOptions.show !== 'always' && (bannerVisible || !chosen))
    if (focusInBanner && !showBanner && !dialogVisible) badge?.focus()
    if (!dialogVisible && dialog.open) dialog.close()
  }

  banner.addEventListener('cancel', (event) => event.preventDefault())
  banner.addEventListener('close', render)
  dialog.addEventListener('close', () => {
    controller.actions.closeDialog()
    const focused = document.activeElement
    if (focused === document.body || dialog.contains(focused)) {
      if (opener instanceof HTMLElement) opener.focus()
      if (document.activeElement !== opener) badge?.focus()
    }
  })
  if (!unstyled) document.head.append(style)
  document.body.prepend(banner, dialog)
  if (badge) document.body.append(badge)
  const unsubscribe = controller.subscribe(render)
  render()
  return () => {
    unsubscribe()
    style.remove()
    banner.remove()
    dialog.remove()
    badge?.remove()
    root.removeAttribute('data-consentlayer-gutter')
  }
}
