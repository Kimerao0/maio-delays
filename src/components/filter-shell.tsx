'use client'

import { cn } from 'cn'
import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, use, useTransition } from 'react'

const FRAME = 'mx-auto w-full max-w-[min(100%-2rem,84rem)]'

const DIM = 'transition-opacity motion-reduce:transition-none'

type FilterNav = { pending: boolean; navigate: (href: string) => void }

const NAV = createContext<FilterNav>({ pending: false, navigate: () => {} })

// A transition keeps the old rows on screen, so the bar cannot own it: the table is a server
// payload and a sibling, and nothing rendered inside the bar can dim it. The controls read the
// state back from here instead of holding it.
export function useFilterNav(): FilterNav {
  return use(NAV)
}

type FilterShellProps = { bar: ReactNode; children: ReactNode }

// `bar` and `children` arrive already rendered on the server, so wrapping them costs the client
// nothing beyond this component itself.
export function FilterShell({ bar, children }: FilterShellProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function navigate(href: string): void {
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <NAV value={{ pending, navigate }}>
      <div className={FRAME}>{bar}</div>
      <div aria-busy={pending} className={cn(DIM, pending && 'opacity-60')}>
        {children}
      </div>
    </NAV>
  )
}
