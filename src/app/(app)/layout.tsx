import { BottomNav, Sidebar } from '@/components/app-nav'
import { UserMenu } from '@/components/user-menu'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-primary/10 bg-white px-4">
        <span className="text-xl font-semibold text-primary">Fornada</span>
        <UserMenu />
      </header>

      <Sidebar />
      <BottomNav />

      <main className="px-4 pb-24 pt-20 md:pb-8 md:pl-60 md:pr-6">
        {children}
      </main>
    </div>
  )
}
