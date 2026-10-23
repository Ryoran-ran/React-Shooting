/** Shared by keyboard and gamepad; menus use native focusable buttons. */
export function menuButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-menu]')].filter((button) => !button.disabled && button.getClientRects().length > 0);
}

export function moveMenuFocus(direction: number): void {
  const buttons = menuButtons();
  if (!buttons.length) return;
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[(index + direction + buttons.length) % buttons.length]?.focus();
}

export function confirmMenu(): void {
  const buttons = menuButtons();
  const focused = document.activeElement as HTMLButtonElement;
  (buttons.includes(focused) ? focused : buttons[0])?.click();
}

export function backMenu(): void {
  document.querySelector<HTMLButtonElement>('[data-back]')?.click();
}
