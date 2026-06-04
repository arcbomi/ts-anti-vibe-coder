import type { ButtonHTMLAttributes } from 'react'

function mergeClassName(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={mergeClassName('button', className)} />
}
