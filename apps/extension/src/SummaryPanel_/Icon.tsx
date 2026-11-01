export function Icon({ name, spinning = false }: { name: 'refresh' | 'up' | 'down'; spinning?: boolean }) {
  return <svg className={spinning ? 'icon spinning' : 'icon'} width="16" height="16"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'refresh'
      ? <><path d="M20 7v5h-5" /><path d="M19.3 8a8 8 0 1 0 .2 7" /></>
      : <path d={name === 'up' ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />}
  </svg>;
}
