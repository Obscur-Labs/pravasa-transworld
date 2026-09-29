interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** Accent when on. 'success' (default) for active/enabled toggles, 'violet' for secondary ones (e.g. website visibility). */
  tone?: 'success' | 'violet';
  /** Native tooltip, handy for explaining why a toggle is disabled. */
  title?: string;
}

export function Switch({ checked, onChange, disabled, tone = 'success', title }: SwitchProps) {
  const onBg = tone === 'violet' ? 'bg-violet-500' : 'bg-success';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      title={title}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? onBg : 'bg-muted'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
