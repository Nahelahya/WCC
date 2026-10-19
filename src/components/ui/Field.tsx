import { forwardRef, useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/session'
import { Icon } from './Icon'

interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  helper?: string
  error?: string
  children: ReactNode
  className?: string
}

function Field({ label, htmlFor, required, helper, error, children, className }: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (wajib diisi)</span>}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={htmlFor ? `${htmlFor}-error` : undefined} role="alert">
          <Icon name="alert" size={15} className="mt-px flex-none" />
          <span>{error}</span>
        </p>
      ) : (
        helper && <p className="field-helper">{helper}</p>
      )}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  helper?: string
  error?: string
  prefix?: string
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, className, required, id, prefix, suffix, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field label={label} htmlFor={inputId} required={required} helper={helper} error={error}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'field-input',
            prefix && 'pl-11',
            suffix && 'pr-11',
            error && 'field-input-error',
            className,
          )}
          {...rest}
        />
        {suffix && <div className="absolute right-2 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </Field>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  helper?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helper, error, className, required, id, children, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field label={label} htmlFor={inputId} required={required} helper={helper} error={error}>
      <select
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn('field-input appearance-none pr-9', error && 'field-input-error', className)}
        {...rest}
      >
        {children}
      </select>
    </Field>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  helper?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, className, required, id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field label={label} htmlFor={inputId} required={required} helper={helper} error={error}>
      <textarea
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn('field-input min-h-[110px] resize-y', error && 'field-input-error', className)}
        {...rest}
      />
    </Field>
  )
})

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  error?: string
}

export function Checkbox({ label, error, className, id, ...rest }: CheckboxProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div>
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
        <input
          id={inputId}
          type="checkbox"
          className={cn(
            'mt-0.5 h-5 w-5 flex-none cursor-pointer rounded border-line text-primary accent-primary focus:ring-2 focus:ring-primary/30',
            className,
          )}
          {...rest}
        />
        <span className="leading-snug">{label}</span>
      </label>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} className="mt-px flex-none" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
