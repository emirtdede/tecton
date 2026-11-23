import { useId } from 'react';

/**
 * Accessible on/off switch.
 *
 * A checkbox would render as the platform's tiny square, which looks out of
 * place next to the settings cards; a real switch also makes the on/off state
 * readable at a glance. The native input stays in the DOM (visually hidden) so
 * keyboard, screen readers and `label` clicks keep working.
 */
export default function Switch({ checked, onChange, disabled = false, label }) {
  const id = useId();
  return (
    <span className={`switch ${checked ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch-input"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={onChange}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </span>
  );
}
