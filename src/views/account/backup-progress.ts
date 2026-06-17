type BackupProgressElements = {
  wrap: HTMLElement;
  bar: HTMLElement;
  percentEl: HTMLElement;
  track: HTMLElement;
  labelEl: HTMLElement;
};

function getProgressElements(prefix: string): BackupProgressElements | null {
  const wrap = document.getElementById(`${prefix}Progress`);
  const bar = document.getElementById(`${prefix}ProgressBar`);
  const percentEl = document.getElementById(`${prefix}ProgressPercent`);
  const track = document.getElementById(`${prefix}ProgressTrack`);
  const labelEl = document.getElementById(`${prefix}ProgressLabel`);
  if (!wrap || !bar || !percentEl || !track || !labelEl) return null;
  return { wrap, bar, percentEl, track, labelEl };
}

export function createBackupProgressController(prefix: string) {
  return {
    show(label: string, percent: number): void {
      const elements = getProgressElements(prefix);
      if (!elements) return;

      const value = Math.min(100, Math.max(0, Math.round(percent)));
      elements.wrap.classList.remove('is-hidden');
      elements.wrap.setAttribute('aria-busy', 'true');
      elements.labelEl.textContent = label;
      elements.bar.style.width = `${value}%`;
      elements.percentEl.textContent = `${value}%`;
      elements.track.setAttribute('aria-valuenow', String(value));
    },
    hide(): void {
      const elements = getProgressElements(prefix);
      if (!elements) return;

      elements.wrap.classList.add('is-hidden');
      elements.wrap.setAttribute('aria-busy', 'false');
      elements.bar.style.width = '0%';
      elements.percentEl.textContent = '0%';
      elements.track.setAttribute('aria-valuenow', '0');
    },
  };
}

export const driveBackupProgress = createBackupProgressController('secDriveBackup');
