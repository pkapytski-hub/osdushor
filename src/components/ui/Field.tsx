import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-accent-600" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs leading-relaxed text-graphite-500">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-accent-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field-input", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("field-input", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("field-input appearance-none bg-white pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string }) {
  const id = props.id;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-accent-600"
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-graphite-800">
          {label}
        </label>
        {description && <p className="mt-1 text-xs leading-relaxed text-graphite-500">{description}</p>}
      </div>
    </div>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-accent-600/40 bg-accent-50 text-accent-800",
    success: "border-emerald-600/30 bg-emerald-50 text-emerald-900",
    info: "border-navy-200 bg-navy-50 text-navy-800",
  }[tone];
  return (
    <div className={cn("border-l-4 px-4 py-3 text-sm leading-relaxed", styles)} role={tone === "error" ? "alert" : undefined}>
      {children}
    </div>
  );
}
