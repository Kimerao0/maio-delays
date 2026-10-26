'use client'

import { cn } from 'cn'
import { Fragment, type ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { EVENTS, type EventDef } from '@/lib/events'

const FRAME = 'mx-auto w-full max-w-[min(100%-2rem,84rem)]'

const LINE = 'flex h-11 items-center justify-between gap-3 text-[13px] text-quiet'

// Inside the band, like the row trigger's: a 13px word does not need a ring twice its own height
// drawn around it.
const FOCUS = 'outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-figure'

// Both halves of the line are operable, so both carry the underline: in a line that is entirely
// quiet there is nothing else left to say so with. Each takes the full 44px band, the way a table
// row does, so the touch target is the band and not the text.
const ACTION = 'inline-flex h-11 items-center underline underline-offset-4'

const BODY = 'text-[13px] text-quiet'

const LIST = 'flex flex-col gap-1'

// The glossary is as wide as its widest code and no wider; the labels take what is left and wrap.
const GLOSSARY = 'grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[13px]'

function codesOf(event: EventDef): string {
  return `${event.shortYes} / ${event.shortNot}`
}

function labelsOf(event: EventDef): string {
  return `${event.labelYes} / ${event.labelNot}`
}

// The screen's own words, picked out of the explanation the way the table picks data out of chrome.
function Term({ children }: { children: string }) {
  return <span className="text-figure">{children}</span>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[11px] text-quiet">{title}</h3>
      {children}
    </section>
  )
}

function Entry({ term, children }: { term: string; children: ReactNode }) {
  return (
    <li className={BODY}>
      <Term>{term}</Term>: {children}
    </li>
  )
}

// The single help affordance on the screen, and the credit the data asks for, on one quiet line
// under the table: no per-control tooltip anywhere, by design.
export function HowItWorks() {
  return (
    <footer className={cn(FRAME, LINE)}>
      <Sheet>
        <SheetTrigger className={cn(ACTION, FOCUS, 'cursor-pointer')}>come funziona</SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto border-rule bg-field motion-reduce:transition-none"
        >
          <SheetHeader className="gap-1">
            <SheetTitle className="text-[15px] font-medium text-figure">come funziona</SheetTitle>
            <SheetDescription className={BODY}>
              Le colonne, i filtri e da dove arriva il numero 1 su.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4 pb-4">
            <Section title="come si legge una riga">
              <p className={BODY}>
                Una riga si legge come una frase: <Term>Boreham Wood — no S — da 13</Term> vuol dire
                «non perde da 13 partite».
              </p>
              <ul className={LIST}>
                <Entry term="DA">
                  quante partite di fila, contando dalla più recente, l’evento non si verifica — o
                  si verifica, se il filtro è su <Term>serie</Term>.
                </Entry>
                <Entry term="EVENTO">
                  l’evento in forma breve sul telefono e per esteso sullo schermo grande;{' '}
                  <Term>1T</Term> dopo il codice vuol dire primo tempo.
                </Entry>
                <Entry term="LEGA">la sigla del campionato.</Entry>
                <Entry term="1 SU">
                  quanto è raro un ritardo così lungo. Più il numero è alto, più è raro.
                </Entry>
              </ul>
              <p className={BODY}>
                L’elenco è ordinato per rarità, non per <Term>DA</Term>: per questo la prima colonna
                sembra fuori ordine.
              </p>
            </Section>

            <Section title="i filtri">
              <ul className={LIST}>
                <Entry term="evento">uno dei 12 eventi, o tutti insieme.</Entry>
                <Entry term="periodo">
                  <Term>90&apos;</Term> per il risultato finale, <Term>1°T</Term> per il primo
                  tempo, letto sui gol del primo tempo.
                </Entry>
                <Entry term="ritardi / serie">
                  un ritardo è una sequenza di partite in cui l’evento non succede, una serie una
                  sequenza in cui succede.
                </Entry>
                <Entry term="dove">
                  tutte le partite, solo quelle in casa o solo quelle in trasferta. Con{' '}
                  <Term>casa</Term> o <Term>trasferta</Term> contano solo quelle partite,
                  consecutive fra loro: una vittoria in trasferta fra due pareggi in casa non
                  interrompe una sequenza casalinga.
                </Entry>
                <Entry term="leghe">quali campionati entrano nel conto.</Entry>
                <Entry term="turni minimo">la lunghezza minima perché una riga compaia.</Entry>
                <Entry term="raro almeno">
                  la soglia sulla colonna <Term>1 SU</Term>, sotto la quale le righe restano fuori.
                </Entry>
              </ul>
            </Section>

            <Section title="come si calcola 1 su">
              <p className={BODY}>
                La rarità di una sequenza è <Term>(1 − p)^n</Term> per un ritardo e <Term>p^n</Term>{' '}
                per una serie, dove <Term>p</Term> è quanto spesso l’evento si verifica e{' '}
                <Term>n</Term> è la lunghezza della sequenza.
              </p>
              <p className={BODY}>
                <Term>p</Term> è la media di tutte le squadre delle leghe selezionate in quel
                momento, non il ritmo della singola squadra: cambia quindi ogni volta che cambia il
                filtro <Term>leghe</Term>.
              </p>
              <p className={BODY}>
                Esempio misurato: Barcelona a 9 vittorie di fila legge <Term>1 su 6.938</Term>,
                calcolato su una media del 37% di vittorie. Sulla forma del Barcelona stesso sarebbe
                vicino a <Term>1 su 2</Term>.
              </p>
              <p className={BODY}>
                Il numero è quindi sovrastimato per le squadre forti, e per le squadre deboli in una
                sequenza negativa: la testa di una lista <Term>serie</Term> dice in parte solo chi è
                più forte.
              </p>
              <p className={BODY}>
                Tratta inoltre le partite come indipendenti, e non lo sono: la qualità di una
                squadra è esattamente il motivo per cui una sequenza continua.
              </p>
              <p className={BODY}>
                È un modo per ordinare l’elenco, <Term>non una quota</Term>.
              </p>
            </Section>

            <Section title="i dati">
              <p className={BODY}>
                Risultati e calendario da football-data.co.uk, solo per la stagione in corso: le
                sequenze ripartono da agosto, per scelta.
              </p>
              <p className={BODY}>
                I file vengono riscaricati al massimo ogni 3 ore. L’orario in alto è il momento del
                download, non quello in cui la pagina è stata disegnata.
              </p>
              <p className={BODY}>
                <Term>PROSSIMA</Term> di solito legge <Term>—</Term>, perché il file del calendario
                a monte porta solo il turno in corso: una prossima partita mancante è normale, non
                un errore.
              </p>
            </Section>

            <Section title="codici evento">
              <dl className={GLOSSARY}>
                {EVENTS.map((event) => (
                  <Fragment key={event.id}>
                    <dt className="text-figure">{codesOf(event)}</dt>
                    <dd className="text-quiet">{labelsOf(event)}</dd>
                  </Fragment>
                ))}
              </dl>
            </Section>
          </div>
        </SheetContent>
      </Sheet>
      <a href="https://football-data.co.uk" rel="noreferrer" className={cn(ACTION, FOCUS)}>
        dati football-data.co.uk
      </a>
    </footer>
  )
}
