'use client'

import { cn } from 'cn'
import Link, { useLinkStatus } from 'next/link'
import { remember } from '@/lib/remember'

const LINK = 'rounded-xs outline-offset-2 focus-visible:outline-2 focus-visible:outline-figure'

const LABEL = 'inline-flex items-center gap-1 transition-opacity motion-reduce:transition-none'

// useLinkStatus only reports from inside the link it belongs to, which is why the acknowledgement
// is a nested component and not a class on the <Link> itself.
function Label({ label, arrow }: { label: string; arrow: string | null }) {
  const { pending } = useLinkStatus()
  return (
    <span className={cn(LABEL, pending && 'opacity-60')}>
      {label}
      {arrow && <span aria-hidden="true">{arrow}</span>}
    </span>
  )
}

type SortLinkProps = { href: string; label: string; arrow: string | null }

export function SortLink({ href, label, arrow }: SortLinkProps) {
  return (
    <Link href={href} scroll={false} onNavigate={() => remember(href)} className={LINK}>
      <Label label={label} arrow={arrow} />
    </Link>
  )
}
