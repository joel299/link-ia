"use client";

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}

export function ColorField({
  id,
  label,
  value,
  onChange,
  error,
}: ColorFieldProps) {
  const safePickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#101312";
  const errorId = `${id}-error`;

  return (
    <div className="field-group">
      <label htmlFor={`${id}-hex`} className="field-label">
        <span>{label}</span>
      </label>
      <div className="color-field-row">
        <input
          type="color"
          aria-label={`Seletor visual de ${label}`}
          value={safePickerValue}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="color-picker-native"
        />
        <input
          id={`${id}-hex`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#101312"
          maxLength={7}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="input"
          style={{ fontFamily: "monospace" }}
        />
      </div>
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
