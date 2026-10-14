'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart3, CreditCard, Package, Users, ShoppingCart, TrendingUp,
  Settings, KeyRound, UserCircle, Database, Store, RefreshCcw,
  Wallet, BoxesIcon, Pause, ClipboardList, Truck, Receipt,
  BookOpen, CircleDollarSign, LogOut
} from 'lucide-react'

// ── Lucide icon mapping (replaces emoji strings) ──
const ICON_MAP: Record<string, React.ElementType> = {
  '📊': BarChart3,
  '💳': CreditCard,
  '📦': Package,
  '👥': Users,
  '🛒': ShoppingCart,
  '📈': TrendingUp,
  '⚙️': Settings,
  '🔑': KeyRound,
  '👤': UserCircle,
  '💾': Database,
  '🏪': Store,
  '🔄': RefreshCcw,
  '💰': Wallet,
  '⏸️': Pause,
  '📋': ClipboardList,
  '🚚': Truck,
  '💸': Receipt,
  '📖': BookOpen,
  'Cuentas por Cobrar': CreditCard,
  'Inventario/Kardex': BoxesIcon,
}

const GROUP_ICON_MAP: Record<string, React.ElementType> = {
  '📊': BarChart3,
  '💳': CreditCard,
  '📦': Package,
  '👥': Users,
  '🛒': ShoppingCart,
  '📈': TrendingUp,
  '⚙️': Settings,
}

function NavIcon({ emoji, className = "w-4 h-4" }: { emoji: string; className?: string }) {
  const IconComponent = ICON_MAP[emoji]
  if (IconComponent) return <IconComponent className={className} />
  return <span className={className}>{emoji}</span>
}

function GroupIcon({ emoji, className = "w-4 h-4" }: { emoji: string; className?: string }) {
  const IconComponent = GROUP_ICON_MAP[emoji]
  if (IconComponent) return <IconComponent className={className} />
  return <span className={className}>{emoji}</span>
}

interface NavItem {
  value: string
  label: string
  icon: string
  badge?: string
  restricted?: boolean
  plan?: string
}

interface NavGroup {
  id: string
  label: string
  icon: string
  color: string
  items: NavItem[]
}

interface AppNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
  tabs: NavItem[]
  stockAlertCount?: number
  currentUser?: string
  storeName?: string
  onLogout?: () => void
  version?: string
}

function buildGroups(tabs: NavItem[], stockAlertCount: number): NavGroup[] {
  const groupMap: Record<string, NavGroup> = {
    inicio:      { id: 'inicio',      label: 'Inicio',       icon: '📊', color: '#6366f1', items: [] },
    ventas:      { id: 'ventas',      label: 'Punto de Venta', icon: '💳', color: '#0ea5e9', items: [] },
    inventario:  { id: 'inventario',  label: 'Inventario',     icon: '📦', color: '#f59e0b', items: [] },
    personas:    { id: 'personas',    label: 'Personas',       icon: '👥', color: '#10b981', items: [] },
    operaciones: { id: 'operaciones', label: 'Operaciones',   icon: '🛒', color: '#ec4899', items: [] },
    informes:    { id: 'informes',    label: 'Informes',       icon: '📈', color: '#8b5cf6', items: [] },
    sistema:     { id: 'sistema',     label: 'Sistema',        icon: '⚙️', color: '#64748b', items: [] },
  }

  for (const tab of tabs) {
    const item: NavItem = { ...tab }
    if (tab.value === 'products' && stockAlertCount > 0) {
      item.badge = stockAlertCount > 9 ? '9+' : String(stockAlertCount)
    }

    switch (tab.value) {
      case 'dashboard':                     groupMap.inicio.items.push(item); break
      case 'pos': case 'cash-closing': case 'held-sales': case 'quotes': case 'delivery-notes':
        groupMap.ventas.items.push(item); break
      case 'products': case 'kardex': case 'catalog':
        groupMap.inventario.items.push(item); break
      case 'clients': case 'suppliers': case 'credit':
        groupMap.personas.items.push(item); break
      case 'purchases': case 'devolutions': case 'expenses':
        groupMap.operaciones.items.push(item); break
      case 'reports':
        groupMap.informes.items.push(item); break
      case 'config': case 'users': case 'license': case 'backup':
        groupMap.sistema.items.push(item); break
    }
  }

  return Object.values(groupMap).filter(g => g.items.length > 0)
}

export default function AppNav({
  activeTab, onTabChange, tabs, stockAlertCount = 0,
  currentUser = '', storeName = '', onLogout, version = ''
}: AppNavProps) {
  const [open, setOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['ventas']))

  const groups = useMemo(() => buildGroups(tabs, stockAlertCount), [tabs, stockAlertCount])

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // Auto-expand group when a tab inside is active
  useEffect(() => {
    const activeGroup = groups.find(g => g.items.some(i => i.value === activeTab))
    if (activeGroup && !expandedGroups.has(activeGroup.id)) {
      setExpandedGroups(prev => new Set([...prev, activeGroup.id]))
    }
  }, [activeTab, groups])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleSelect = (value: string) => {
    onTabChange(value)
    setOpen(false)
  }

  // ── Chevron SVG ──
  const Chevron = ({ expanded }: { expanded: boolean }) => (
    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )

  // ── Badge ──
  const BadgeDot = ({ count, color }: { count: number; color?: string }) => {
    if (count <= 0) return null
    return (
      <span className={`ml-auto text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${color || 'bg-red-500 text-white'}`}>
        {count > 9 ? '9+' : count}
      </span>
    )
  }

  // ── Plan Badge ──
  const PlanBadge = ({ plan }: { plan: string }) => (
    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
      {plan}
    </span>
  )

  // ── Active indicator ──
  const ActiveDot = () => (
    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground/80" />
  )

  // ═══════════════════════════════════════════════════
  // SIDEBAR CONTENT
  // ═══════════════════════════════════════════════════
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* ── Logo / Header ── */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/25">
            MC
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{storeName || 'MyCommerce'}</h2>
            <p className="text-[10px] text-blue-300/70 font-medium">Sistema de Ventas POS</p>
          </div>
        </div>
      </div>

      {/* ── Navigation Groups ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id)
          const isActiveInGroup = group.items.some(i => i.value === activeTab)
          const hasBadge = group.items.some(i => i.badge)
          const totalBadge = group.items.reduce((s, i) => s + (parseInt(i.badge || '0')), 0)

          return (
            <div key={group.id} className="mb-0.5">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all text-left ${
                  isActiveInGroup
                    ? 'text-white bg-white/10 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                style={{ '--group-color': group.color } as React.CSSProperties}
              >
                <GroupIcon emoji={group.icon} className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{group.label}</span>
                {hasBadge && <BadgeDot count={totalBadge} />}
                <Chevron expanded={isExpanded} />
              </button>

              {/* Group items */}
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
                isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="pl-4 pr-1 py-0.5 space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.value
                    return (
                      <button
                        key={item.value}
                        onClick={() => handleSelect(item.value)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left ${
                          isActive
                            ? 'bg-white/15 text-white shadow-sm shadow-black/20 border-l-2 border-white/50'
                            : 'text-slate-300 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                        }`}
                      >
                        <NavIcon emoji={item.icon} className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.restricted && item.plan && <PlanBadge plan={item.plan} />}
                        {item.badge && <BadgeDot count={parseInt(item.badge)} />}
                        {isActive && <ActiveDot />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── User / Footer ── */}
      <div className="px-3 py-3 border-t border-white/10 bg-black/20">
        {currentUser && (
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow">
              {currentUser.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentUser}</p>
              <p className="text-[10px] text-blue-300/60">Conectado</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-medium">
            v{version || '2.9.56'}
          </span>
          {onLogout && (
            <button
              onClick={() => { setOpen(false); onLogout() }}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-white/5"
            >
              <LogOut className="w-3 h-3" />
              Salir
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 group"
        aria-label="Abrir menu"
      >
        <div className="flex flex-col gap-[3px] items-center">
          <span className="block w-5 h-[2px] bg-slate-600 dark:bg-slate-300 group-hover:w-4 transition-all rounded-full" />
          <span className="block w-5 h-[2px] bg-slate-600 dark:bg-slate-300 group-hover:w-3.5 transition-all rounded-full" />
          <span className="block w-5 h-[2px] bg-slate-600 dark:bg-slate-300 group-hover:w-5 transition-all rounded-full" />
        </div>
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar drawer ── */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-[100] w-[290px] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          boxShadow: open ? '20px 0 60px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-3 z-10 flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {sidebarContent}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── TOP NAV BAR (desktop only) ── */}
      {/* ═══════════════════════════════════════════════════ */}
      <TopNavBar
        groups={groups}
        activeTab={activeTab}
        onTabChange={onTabChange}
        stockAlertCount={stockAlertCount}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════
// TOP NAV BAR — grouped dropdown menus for desktop
// ═══════════════════════════════════════════════════════

function TopNavBar({ groups, activeTab, onTabChange, stockAlertCount }: {
  groups: NavGroup[]
  activeTab: string
  onTabChange: (tab: string) => void
  stockAlertCount: number
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlotEl(document.getElementById('top-nav-slot'))
  }, [])

  const handleMouseEnter = (groupId: string) => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current)
    setOpenMenu(groupId)
  }

  const handleMouseLeave = () => {
    menuTimeoutRef.current = setTimeout(() => setOpenMenu(null), 150)
  }

  useEffect(() => {
    const handler = () => setOpenMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const navContent = (
    <nav className="hidden lg:flex items-center gap-0.5">
      {groups.map((group) => {
        const isActiveInGroup = group.items.some(i => i.value === activeTab)
        const isOpen = openMenu === group.id
        const totalBadge = group.items.reduce((s, i) => s + (parseInt(i.badge || '0')), 0)

        return (
          <div
            key={group.id}
            className="relative"
            onMouseEnter={() => handleMouseEnter(group.id)}
            onMouseLeave={handleMouseLeave}
          >
            {/* Menu trigger */}
            <button
              onClick={(e) => { e.stopPropagation(); setOpenMenu(isOpen ? null : group.id) }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 ${
                isActiveInGroup
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <GroupIcon emoji={group.icon} className="w-4 h-4" />
              <span>{group.label}</span>
              {totalBadge > 0 && (
                <span className="text-[10px] font-bold rounded-full bg-red-500 text-white min-w-[16px] h-[16px] flex items-center justify-center px-1">
                  {totalBadge > 9 ? '9+' : totalBadge}
                </span>
              )}
              <svg className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-56 z-50 rounded-xl border shadow-xl shadow-black/10 bg-card border-slate-200/80 dark:border-slate-700/50 dark:bg-slate-900 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <GroupIcon emoji={group.icon} className="w-3.5 h-3.5" />
                    {group.label}
                  </p>
                </div>
                <div className="py-1">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.value
                    return (
                      <button
                        key={item.value}
                        onClick={() => { onTabChange(item.value); setOpenMenu(null) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-all text-left ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <NavIcon emoji={item.icon} className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.restricted && item.plan && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                            {item.plan}
                          </span>
                        )}
                        {item.badge && (
                          <span className="text-[10px] font-bold rounded-full bg-red-500 text-white min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {item.badge}
                          </span>
                        )}
                        {isActive && (
                          <svg className="w-4 h-4 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  if (slotEl) {
    return createPortal(navContent, slotEl)
  }
  return navContent
}
