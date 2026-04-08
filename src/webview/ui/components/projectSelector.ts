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

export function renderProjectSelector(container: HTMLElement, options: ProjectSelectorOptions): void {
  const { sessions, currentFilter, allowAll, pageId } = options;

  // Clear existing selector if present
  const existing = container.querySelector('.project-selector');
  if (existing) existing.remove();

  const select = document.createElement('select');
  select.className = 'project-selector';

  if (sessions.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'NO ACTIVE SESSIONS';
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
    select.disabled = true;
    container.prepend(select);
    return;
  }

  if (allowAll) {
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'ALL PROJECTS';
    if (currentFilter === null) allOpt.selected = true;
    select.appendChild(allOpt);
  }

  // Detect duplicate project names so we can disambiguate
  const nameCounts = new Map<string, number>();
  for (const s of sessions) {
    const name = s.projectName ?? s.sessionId;
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  for (const session of sessions) {
    const opt = document.createElement('option');
    opt.value = session.sessionId;
    const name = session.projectName ?? session.sessionId;
    const isDuplicate = (nameCounts.get(name) ?? 0) > 1;
    if (isDuplicate && session.firstSeen) {
      const time = new Date(session.firstSeen).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      opt.textContent = `${name} (${time})`;
    } else {
      opt.textContent = name;
    }
    if (currentFilter === session.sessionId) opt.selected = true;
    select.appendChild(opt);
  }

  // If not allowAll and no currentFilter, select the first session
  if (!allowAll && currentFilter === null && sessions.length > 0) {
    select.value = sessions[0].sessionId;
  }

  select.addEventListener('change', () => {
    const value = select.value;
    sendToExtension({
      type: 'requestPageData',
      payload: { pageId, projectFilter: value || undefined },
    });
  });

  container.prepend(select);
}
