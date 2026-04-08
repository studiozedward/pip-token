/**
 * Render the advisory box in the given container.
 * Shows the message with a > prefix, or hides the box if null/empty.
 */
export function renderAdvisory(container: HTMLElement, advisory: string | null | undefined): void {
  const el = container.querySelector('.advisory') as HTMLElement | null;
  if (!el) return;

  if (advisory) {
    el.innerHTML = `<span class="advisory-prefix">&gt;</span> ${advisory}`;
    el.style.display = '';
  } else {
    el.innerHTML = '';
    el.style.display = 'none';
  }
}
