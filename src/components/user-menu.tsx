'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut, User, UserCircle } from 'lucide-react'

export function UserMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Menu do usuário"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-1 text-charcoal hover:bg-cream"
      >
        <UserCircle size={28} strokeWidth={1.6} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-primary/10"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-charcoal hover:bg-cream"
          >
            <User size={16} />
            Meu perfil
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-charcoal hover:bg-cream"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
