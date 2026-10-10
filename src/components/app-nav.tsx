'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  FileDown,
  Package,
  CircleDollarSign,
  Tag,
} from 'lucide-react'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/recipes', label: 'Receitas', icon: BookOpen },
  { href: '/ingredients', label: 'Insumos', icon: Package },
  { href: '/imports/nfe', label: 'NF-e', icon: FileDown },
  { href: '/costs', label: 'Financeiro', icon: CircleDollarSign },
  { href: '/pricing', label: 'Preços', icon: Tag },
]

function useIsActive() {
  const pathname = usePathname()
  return (href: string) => pathname === href || pathname.startsWith(href + '/')
}

export function BottomNav() {
  const isActive = useIsActive()
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-primary/10 bg-white md:hidden"
    >
      <ul className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] ${
                  active ? 'font-semibold text-primary' : 'text-charcoal'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function Sidebar() {
  const isActive = useIsActive()
  return (
    <aside className="fixed bottom-0 left-0 top-14 z-20 hidden w-56 border-r border-primary/10 bg-white md:block">
      <nav aria-label="Navegação principal" className="p-3">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                    active
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-charcoal hover:bg-cream'
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
