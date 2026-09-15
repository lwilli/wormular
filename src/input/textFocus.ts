/** True when keyboard input should go to a form field, not game controls. */
export function typingInField(): boolean {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

/** Drop text focus so a canvas press can start / thrust. */
export function blurTextField(): void {
  const el = document.activeElement
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  ) {
    el.blur()
  }
}
