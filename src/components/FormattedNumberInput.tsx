import React, { useState, useEffect } from 'react';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (val: string) => void;
}

export default function FormattedNumberInput({ value, onChange, className, ...props }: Props) {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (value === "" || value === null || value === undefined) {
      setDisplayValue("");
    } else {
      const numericString = String(value).replace(/[^0-9]/g, '');
      if (numericString) {
        setDisplayValue(Number(numericString).toLocaleString('en-US'));
      } else {
        setDisplayValue("");
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/[^0-9]/g, '');
    onChange(rawValue);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
}
