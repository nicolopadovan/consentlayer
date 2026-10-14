import { controller } from './analytics'

const banner = document.getElementById('consent-banner')!
const dialog = document.getElementById('consent-dialog') as HTMLDialogElement
const settings = document.getElementById('cookie-settings')!
const list = document.getElementById('consent-categories')!

type Action = 'acceptAll' | 'rejectNonEssential' | 'savePreferences' | 'openDialog' | 'closeDialog'

function renderCategories() {
  const { categories, prefs } = controller.getSnapshot()
  list.replaceChildren(
    ...categories.map((category) => {
      const label = document.createElement('label')
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = prefs[category]
      input.onchange = () =>
        controller.actions.setPrefs({ ...controller.getSnapshot().prefs, [category]: input.checked })
      label.append(input, ` ${category}`)
      return label
    }),
  )
}

function render() {
  const { ready, bannerVisible, dialogVisible } = controller.getSnapshot()
  banner.hidden = !ready || !bannerVisible || dialogVisible
  settings.hidden = !ready || bannerVisible
  if (dialogVisible && !dialog.open) {
    renderCategories()
    dialog.showModal()
  }
  if (!dialogVisible && dialog.open) dialog.close()
}

document.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
  if (action) void controller.actions[action as Action]()
})
dialog.addEventListener('close', () => controller.actions.closeDialog())
controller.subscribe(render)
render()
