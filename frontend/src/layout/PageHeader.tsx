import { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 rounded-2xl border border-line-subtle bg-panel/55 px-5 py-5 shadow-glass backdrop-blur-glass md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-blue">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold leading-tight text-ink-primary md:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-secondary">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
