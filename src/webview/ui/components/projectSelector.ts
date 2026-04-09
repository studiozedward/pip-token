import { sendToExtension } from '../../messageBus';

interface SessionInfo {
  sessionId: string;
  projectName: string | null;
  lastActivity: string;
  firstSeen?: string;
}

interface ProjectSelectorOptions {
  sessions: SessionInfo[];
  currentFilter: string | null;
  allowAll: boolean;
  pageId: string;
}

interface SelectItem {
  value: string;
  label: string;
}

function formatSessionLabel(session: SessionInfo): string {
  const name = session.projectName ?? session.sessionId;
  if (session.firstSeen) {
    const d = new Date(session.firstSeen);
    const date = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${name} (${date}, ${time})`;
  }
  return name;
}

export function renderProjectSelector(container: HTMLElement, options: ProjectSelectorOptions): void {
  const { sessions, currentFilter, allowAll, pageId } = options;

  // Clear existing selector if present
  const existing = container.querySelector('.pip-select');
  if (existing) existing.remove();

  // Build items list
  const items: SelectItem[] = [];

  if (sessions.length === 0) {
    renderDisabled(container, 'NO ACTIVE SESSIONS');
    return;
  }

  if (allowAll) {
    items.push({ value: '', label: 'ALL PROJECTS' });
  }

  for (const session of sessions) {
    items.push({ value: session.sessionId, label: formatSessionLabel(session) });
  }

  // Determine which item is selected
  let selectedValue: string;
  if (currentFilter !== null) {
    selectedValue = currentFilter;
  } else if (allowAll) {
    selectedValue = '';
  } else if (sessions.length > 0) {
    selectedValue = sessions[0].sessionId;
  } else {
    selectedValue = '';
  }

  const selectedItem = items.find(i => i.value === selectedValue) ?? items[0];

  // Build DOM
  const wrapper = document.createElement('div');
  wrapper.className = 'pip-select';

  const trigger = document.createElement('button');
  trigger.className = 'pip-select-trigger';
  trigger.innerHTML = `<span class="pip-select-label">${escapeHtml(selectedItem.label)}</span><span class="pip-select-arrow">\u25BC</span>`;

  const dropdown = document.createElement('div');
  dropdown.className = 'pip-select-dropdown';

  for (const item of items) {
    const opt = document.createElement('div');
    opt.className = 'pip-select-option' + (item.value === selectedValue ? ' selected' : '');
    opt.dataset.value = item.value;
    opt.textContent = item.label;
    dropdown.appendChild(opt);
  }

  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);

  // --- Event handling ---

  function closeDropdown(): void {
    wrapper.classList.remove('open');
  }

  function selectItem(value: string, label: string): void {
    // Update trigger label
    const labelEl = trigger.querySelector('.pip-select-label');
    if (labelEl) labelEl.textContent = label;

    // Update selected state on options
    dropdown.querySelectorAll('.pip-select-option').forEach(el => {
      el.classList.toggle('selected', (el as HTMLElement).dataset.value === value);
    });

    closeDropdown();

    // Notify extension
    sendToExtension({
      type: 'requestPageData',
      payload: { pageId, projectFilter: value || undefined },
    });
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.toggle('open');
  });

  dropdown.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.pip-select-option') as HTMLElement | null;
    if (!target) return;
    selectItem(target.dataset.value ?? '', target.textContent ?? '');
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      closeDropdown();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  container.prepend(wrapper);
}

function renderDisabled(container: HTMLElement, text: string): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'pip-select disabled';

  const trigger = document.createElement('button');
  trigger.className = 'pip-select-trigger';
  trigger.disabled = true;
  trigger.innerHTML = `<span class="pip-select-label">${escapeHtml(text)}</span>`;

  wrapper.appendChild(trigger);
  container.prepend(wrapper);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
