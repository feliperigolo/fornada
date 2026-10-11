import type { InputHTMLAttributes } from 'react'

const fmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** Valor numérico em reais; 0 mostra o campo vazio. */
  value: number
  onChange: (value: number) => void
}

/**
 * Campo monetário com máscara pt-BR: os dígitos digitados entram pelos centavos
 * (1 → 0,01 · 15508 → 155,08 · 1550874 → 15.508,74). O estado do pai é sempre numérico.
 */
export function MoneyInput({ value, onChange, ...rest }: Props) {
  return (
    <input
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      value={value > 0 ? fmt.format(value) : ''}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
        onChange(Number(digits || 0) / 100)
      }}
    />
  )
}
