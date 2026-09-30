import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity, ArrowDownUp, Bell, BookOpen, CalendarDays, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, FileImage, FileText,
  Heart, Home, LayoutDashboard, LogOut, Menu, MessageSquareText, MoreHorizontal,
  Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Upload,
  Users, X,
} from 'lucide-react'
import './App.css'
import { createAttendanceEvent, createMember, createMemberNote, getChurchMembership, getPrivateDocumentUrl, listAttendanceEvents, listDocuments, listMembers, runDocumentOcr, updateMember, uploadMemberDocument } from './lib/records'
import { supabase, supabaseConfigured } from './lib/supabase'
import type { AttendanceEvent, ChurchMembership, DocumentRecord, Member } from './lib/types'
import LoginScreen from './components/LoginScreen'
import PasswordRecoveryScreen from './components/PasswordRecoveryScreen'

const initialMembers: Member[] = [
  { id: 'CR-1048', name: 'Eleanor Pena', email: 'eleanor.pena@email.com', phone: '(415) 555-0184', family: 'The Penas', role: 'Member', joined: 'Mar 12, 2021', status: 'Active', initials: 'EP', color: 'lilac', lastSeen: 'Today', notes: ['Prefers email contact', 'Volunteers with the welcome team'] },
  { id: 'CR-1047', name: 'Cody Fisher', email: 'cody.fisher@email.com', phone: '(415) 555-0131', family: 'The Fishers', role: 'Member', joined: 'Jun 08, 2019', status: 'Active', initials: 'CF', color: 'peach', lastSeen: 'Today', notes: ['Small group leader'] },
  { id: 'CR-1046', name: 'Esther Howard', email: 'esther.h@email.com', phone: '(415) 555-0120', family: 'Howard family', role: 'Member', joined: 'Jan 25, 2023', status: 'Active', initials: 'EH', color: 'blue', lastSeen: 'Sep 22', notes: ['New member class completed'] },
  { id: 'CR-1045', name: 'Bessie Cooper', email: 'bessie.c@email.com', phone: '(415) 555-0177', family: 'The Coopers', role: 'Member', joined: 'Oct 02, 2018', status: 'Active', initials: 'BC', color: 'green', lastSeen: 'Sep 22', notes: ['Care team follow-up in October'] },
  { id: 'CR-1044', name: 'Jenny Wilson', email: 'jenny.w@email.com', phone: '(415) 555-0199', family: 'The Wilsons', role: 'Visitor', joined: 'Sep 15, 2024', status: 'Visitor', initials: 'JW', color: 'yellow', lastSeen: 'Sep 15', notes: ['First-time visitor; send welcome card'] },
  { id: 'CR-1043', name: 'Robert Fox', email: 'robert.fox@email.com', phone: '(415) 555-0160', family: 'Fox household', role: 'Member', joined: 'May 17, 2020', status: 'Active', initials: 'RF', color: 'pink', lastSeen: 'Sep 08', notes: [] },
  { id: 'CR-1042', name: 'Courtney Henry', email: 'courtney.h@email.com', phone: '(415) 555-0118', family: 'The Henrys', role: 'Member', joined: 'Feb 11, 2022', status: 'Inactive', initials: 'CH', color: 'mint', lastSeen: 'Aug 25', notes: ['Away for the summer'] },
  { id: 'CR-1041', name: 'Arlene McCoy', email: 'arlene.m@email.com', phone: '(415) 555-0155', family: 'McCoy household', role: 'Member', joined: 'Aug 03, 2017', status: 'Active', initials: 'AM', color: 'lavender', lastSeen: 'Aug 25', notes: ['Interested in the choir'] },
]

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Members', icon: Users },
  { label: 'Families', icon: Home },
  { label: 'Attendance', icon: CalendarDays },
  { label: 'Documents', icon: FileText },
  { label: 'Notes', icon: MessageSquareText },
]
const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

function App() {
  const [members, setMembers] = useState(supabaseConfigured ? [] : initialMembers)
  const [selectedId, setSelectedId] = useState(initialMembers[0].id)
  const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEvent[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery')
  const [membership, setMembership] = useState<ChurchMembership | null>(null)
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [activePage, setActivePage] = useState('Members')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All members')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showAttendance, setShowAttendance] = useState(false)
  const [ocrDocument, setOcrDocument] = useState<DocumentRecord | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [toast, setToast] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editStatus, setEditStatus] = useState<Member['status']>('Active')
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [attendanceType, setAttendanceType] = useState('Sunday gathering')
  const [attendingIds, setAttendingIds] = useState<string[]>([])
  const selectedMember = members.find((member) => member.id === selectedId) ?? members[0]
  const canManage = !supabaseConfigured || ['owner', 'admin', 'staff'].includes(membership?.role ?? '')
  const canWriteNotes = !supabaseConfigured || ['owner', 'admin'].includes(membership?.role ?? '')
  const visibleNavigation = navigation.filter(({ label }) => !supabaseConfigured
    || (label !== 'Notes' || ['owner', 'admin'].includes(membership?.role ?? ''))
    && (label !== 'Documents' || ['owner', 'admin', 'pastor', 'staff'].includes(membership?.role ?? '')))

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setWorkspaceError(error.message)
      setWorkspaceLoading(Boolean(data.session))
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setWorkspaceError('')
      setWorkspaceLoading(Boolean(nextSession))
      setSession(nextSession)
      if (!nextSession) {
        setMembership(null)
        setMembers([])
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user.id) return
    let cancelled = false
    void (async () => {
      try {
        const churchMembership = await getChurchMembership(supabase, session.user.id)
        const [records, events, documentRecords] = await Promise.all([
          listMembers(supabase, churchMembership.churchId),
          listAttendanceEvents(supabase, churchMembership.churchId),
          listDocuments(supabase, churchMembership.churchId),
        ])
        if (cancelled) return
        const lastSeenByMember = new Map<string, string>()
        for (const event of events) {
          for (const memberId of event.memberIds) {
            if (!lastSeenByMember.has(memberId)) lastSeenByMember.set(memberId, formatAttendanceDate(event.date))
          }
        }
        setMembership(churchMembership)
        setAttendanceEvents(events)
        setDocuments(documentRecords)
        setMembers(records.map((member) => ({ ...member, lastSeen: lastSeenByMember.get(member.id) ?? 'Not recorded' })))
        setSelectedId(records[0]?.id ?? '')
      } catch (error) {
        if (!cancelled) setWorkspaceError(error instanceof Error ? error.message : 'Could not load this church workspace.')
      } finally {
        if (!cancelled) setWorkspaceLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [session])

  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesQuery = `${member.name} ${member.email} ${member.family} ${member.recordCode ?? member.id}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All members' || member.status === filter
    return matchesQuery && matchesFilter
  }), [filter, members, query])
  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / pageSize))
  const pageMembers = filteredMembers.slice((page - 1) * pageSize, page * pageSize)

  async function saveMemberChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedMember || !editName.trim()) return
    try {
      if (supabase && membership) await updateMember(supabase, membership.churchId, selectedMember.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        status: editStatus,
      })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save member changes')
      return
    }
    const name = editName.trim()
    const updatedMember = {
      ...selectedMember,
      name,
      email: editEmail.trim() || 'No email added',
      phone: editPhone.trim() || 'No phone added',
      status: editStatus,
      initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
    }
    setMembers((current) => current.map((member) => member.id === selectedMember.id ? updatedMember : member))
    setShowEdit(false)
    notify(supabaseConfigured ? 'Member profile updated' : 'Preview only: profile changes are not saved')
  }

  async function openDocument(documentId: string) {
    if (!supabase) return
    const record = documents.find((document) => document.id === documentId)
    if (!record) return
    try {
      const url = await getPrivateDocumentUrl(supabase, record.storagePath)
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.click()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not open private document')
    }
  }

  async function saveAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !membership) {
      notify('Preview only: attendance is not saved')
      setShowAttendance(false)
      return
    }
    try {
      await createAttendanceEvent(supabase, membership.churchId, attendanceDate, attendanceType, attendingIds)
      const events = await listAttendanceEvents(supabase, membership.churchId)
      const lastSeenByMember = new Map<string, string>()
      for (const attendanceEvent of events) {
        for (const memberId of attendanceEvent.memberIds) {
          if (!lastSeenByMember.has(memberId)) lastSeenByMember.set(memberId, formatAttendanceDate(attendanceEvent.date))
        }
      }
      setAttendanceEvents(events)
      setMembers((current) => current.map((member) => ({ ...member, lastSeen: lastSeenByMember.get(member.id) ?? 'Not recorded' })))
      setShowAttendance(false)
      notify('Attendance recorded securely')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not record attendance')
    }
  }

  function beginEdit() {
    if (!selectedMember) return
    setEditName(selectedMember.name)
    setEditEmail(selectedMember.email === 'No email added' ? '' : selectedMember.email)
    setEditPhone(selectedMember.phone === 'No phone added' ? '' : selectedMember.phone)
    setEditStatus(selectedMember.status)
    setShowEdit(true)
  }

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    let memberId: string
    let recordCode: string | undefined
    try {
      if (supabase && membership) {
        const created = await createMember(supabase, membership.churchId, name, newEmail.trim())
        memberId = created.id
        recordCode = created.recordCode
      } else {
        memberId = crypto.randomUUID()
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save member record')
      return
    }
    const member: Member = {
      id: memberId,
      recordCode: recordCode ?? `CR-${1049 + members.length - initialMembers.length}`,
      name,
      email: newEmail.trim() || 'No email added',
      phone: 'Add phone number',
      family: 'Unassigned household',
      role: 'Member',
      joined: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Visitor',
      initials,
      color: 'mint',
      lastSeen: 'Not recorded',
      notes: [],
    }
    setMembers((current) => [member, ...current])
    setSelectedId(member.id)
    setFilter('All members')
    setShowAdd(false)
    setNewName('')
    setNewEmail('')
    notify(supabaseConfigured ? 'Member record saved securely' : 'Preview only: member is not saved')
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!noteText.trim() || !selectedMember) return
    try {
      if (supabase && membership) await createMemberNote(supabase, membership.churchId, selectedMember.id, noteText.trim())
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save note')
      return
    }
    setMembers((current) => current.map((member) => member.id === selectedMember.id
      ? { ...member, notes: [noteText.trim(), ...member.notes] }
      : member))
    setNoteText('')
    notify(supabaseConfigured ? 'Note saved to member record' : 'Preview only: note is not saved')
  }

  async function handleDocument(file?: File) {
    if (!file) return
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('Use a PDF, JPEG, PNG, or WebP document')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      notify('Please choose a file smaller than 12 MB')
      return
    }
    if (!supabase || !membership || !session?.access_token || !selectedMember) {
      notify('Choose a member in the preview. Connect Supabase to save documents.')
      return
    }
    try {
      const documentId = await uploadMemberDocument(supabase, membership.churchId, selectedMember.id, file)
      setDocuments(await listDocuments(supabase, membership.churchId))
      notify('Document uploaded privately. Starting OCR...')
      await runDocumentOcr(session.access_token, documentId)
      setDocuments(await listDocuments(supabase, membership.churchId))
      notify('Document uploaded and text extracted securely')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Document upload or OCR failed')
    }
  }

  const isDirectory = activePage === 'Members' || activePage === 'Overview'
  const displayName = session?.user.user_metadata.full_name ?? session?.user.email?.split('@')[0] ?? 'Jordan Davis'
  const initials = displayName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || 'JD'

  if (supabaseConfigured && supabase && passwordRecovery && session) return <PasswordRecoveryScreen client={supabase} onContinue={() => setPasswordRecovery(false)} />
  if (authLoading || workspaceLoading) return <div className="auth-loading"><div className="brand-mark"><BookOpen size={19} /></div><span>Opening your church workspace...</span></div>
  if (supabaseConfigured && !session && supabase) return <LoginScreen client={supabase} />
  if (supabaseConfigured && session && !membership && !workspaceError) return <div className="auth-loading"><div className="brand-mark"><BookOpen size={19} /></div><span>Checking church workspace access...</span></div>
  if (supabaseConfigured && session && workspaceError) return <div className="auth-loading"><div className="auth-error-card"><ShieldCheck size={25} /><h1>Workspace access required</h1><p>{workspaceError}</p><button className="button button-outline" onClick={() => void supabase?.auth.signOut()}>Sign out</button></div></div>

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><BookOpen size={19} strokeWidth={2.1} /></div><span>church<span className="brand-light">records</span></span></div>
        <div className="church-switcher"><div className="church-seal">{membership?.churchName[0] ?? 'H'}</div><div className="church-copy"><b>{membership?.churchName ?? 'Harbor Community'}</b><small>{supabaseConfigured ? 'Church workspace' : 'Preview workspace'}</small></div><ChevronDown size={15} /></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {visibleNavigation.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${activePage === label ? 'nav-active' : ''}`} onClick={() => { setActivePage(label); setMobileNav(false) }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Notes' && <span className="nav-count">{members.reduce((count, member) => count + member.notes.length, 0)}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-box"><div className="storage-icon"><ShieldCheck size={17} /></div><div><b>Your records are private</b><p>Only authorized staff can access this workspace.</p></div></div>
          <button className="nav-link"><Settings size={18} /><span>Settings</span></button>
          <div className="profile-menu"><div className="avatar avatar-admin">{initials}</div><div className="profile-copy"><b>{displayName}</b><small>{membership?.role ?? 'Preview administrator'}</small></div>{supabaseConfigured && <button className="sign-out-button" aria-label="Sign out" onClick={() => void supabase?.auth.signOut()}><LogOut size={16} /></button>}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><b>{activePage}</b></div>
          <div className="top-actions"><span className="today-label">{todayLabel}</span><button className="icon-button" aria-label="Help"><CircleHelp size={19} /></button><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button><div className="top-avatar">{initials}</div></div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> {(membership?.churchName ?? 'HARBOR COMMUNITY CHURCH').toUpperCase()}</div><h1>{activePage === 'Overview' ? `Good morning, ${displayName.split(' ')[0]}` : activePage}</h1><p>{activePage === 'Members' ? 'A thoughtful place to care for your community.' : pageDescription(activePage)}</p></div>
            <div className="heading-actions">{isDirectory && <button className="button button-outline" onClick={() => notify('Export is available after connecting your records database')}><ArrowDownUp size={16} /> Export</button>}{canManage && <button className="button button-primary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add member</button>}</div>
          </div>

          {!supabaseConfigured && <div className="preview-banner"><span><Sparkles size={15} /></span><div><b>Preview workspace</b><small>Sample records only. Changes are local and are not saved.</small></div><span className="preview-tag">DEMO</span></div>}

          <section className="stat-grid" aria-label="Church membership summary">
            <StatCard icon={<Users size={17} />} title="Total members" value={supabaseConfigured ? members.length.toLocaleString() : '1,284'} trend={supabaseConfigured ? 'In this workspace' : '+ 18 this month'} accent="sage" />
            <StatCard icon={<Heart size={17} />} title="Active members" value={supabaseConfigured ? members.filter((member) => member.status === 'Active').length.toLocaleString() : '1,146'} trend={supabaseConfigured ? 'Current member records' : '89.3% of records'} accent="coral" />
            <StatCard icon={<CalendarDays size={17} />} title="Avg. attendance" value={supabaseConfigured ? `${members.filter((member) => member.status === 'Active').length ? Math.round(attendanceEvents.reduce((sum, event) => sum + event.presentCount, 0) / Math.max(1, attendanceEvents.length) / members.filter((member) => member.status === 'Active').length * 100) : 0}%` : '72%'} trend={supabaseConfigured ? 'Across recent gatherings' : '+ 4.2% this quarter'} accent="gold" />
            <StatCard icon={<FileText size={17} />} title="Needs follow-up" value={supabaseConfigured ? members.filter((member) => member.notes.length > 0).length.toLocaleString() : '12'} trend={supabaseConfigured ? 'Members with private notes' : '3 added this week'} accent="blue" />
          </section>

          {activePage === 'Attendance' ? <AttendanceView events={attendanceEvents} demo={!supabaseConfigured} memberCount={members.length} canManage={canManage} onRecord={() => { setAttendanceDate(new Date().toISOString().slice(0, 10)); setAttendingIds([]); setShowAttendance(true) }} /> : activePage === 'Families' ? <FamiliesView members={members} onSelect={(id) => { setSelectedId(id); setActivePage('Members') }} /> : activePage === 'Documents' ? <DocumentsView documents={documents} demo={!supabaseConfigured} canUpload={canManage} selectedMemberName={selectedMember?.name} onOpen={(id) => { void openDocument(id) }} onViewOcr={(id) => setOcrDocument(documents.find((document) => document.id === id) ?? null)} /> : activePage === 'Notes' ? <NotesView members={members} onSelect={(id) => { setSelectedId(id); setActivePage('Members') }} /> : <>
            <section className="directory-panel">
              <div className="panel-head"><div><h2>{activePage === 'Overview' ? 'Recently added members' : 'Member directory'}</h2><p>Showing {filteredMembers.length} of {supabaseConfigured ? members.length : '1,284'} records</p></div><button className="icon-button filter-button" aria-label="Filter members"><SlidersHorizontal size={18} /></button></div>
              <div className="directory-controls"><div className="search-wrap"><Search size={17} /><input aria-label="Search members" placeholder="Search by name, family, or ID..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /><kbd>⌘ K</kbd></div><div className="filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter by member status" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }}><option>All members</option><option>Active</option><option>Visitor</option><option>Inactive</option></select><ChevronDown size={14} /></div><select className="button button-filter" aria-label="Filter by member status" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }}><option>All members</option><option>Active</option><option>Visitor</option><option>Inactive</option></select></div>
              <div className="table-scroll"><table className="members-table"><thead><tr><th><input type="checkbox" aria-label="Select all members" /></th><th>MEMBER <ArrowDownUp size={12} /></th><th>FAMILY</th><th>PHONE</th><th>JOINED</th><th>STATUS</th><th>LAST ATTENDED</th><th></th></tr></thead><tbody>{pageMembers.map((member) => <tr key={member.id} onClick={() => setSelectedId(member.id)} className={selectedId === member.id ? 'row-selected' : ''}><td><input type="checkbox" aria-label={`Select ${member.name}`} onClick={(event) => event.stopPropagation()} /></td><td><div className="member-cell"><div className={`avatar avatar-${member.color}`}>{member.initials}</div><div className="member-name"><b>{member.name}</b><small>{member.email}</small></div></div></td><td><span className="family-label"><Users size={13} />{member.family}</span></td><td className="phone-cell">{member.phone}</td><td>{member.joined}</td><td><span className={`status status-${member.status.toLowerCase()}`}><i />{member.status}</span></td><td><span className={`attended ${member.lastSeen === 'Today' ? 'attended-today' : ''}`}>{member.lastSeen}</span></td><td><button className="row-more" aria-label={`More actions for ${member.name}`} onClick={(event) => { event.stopPropagation(); notify(`Actions for ${member.name}`) }}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{filteredMembers.length === 0 && <div className="empty-state"><Search size={22} /><b>No members found</b><span>Try a different name or status filter.</span></div>}</div>
              <div className="table-footer"><span>Showing <b>{filteredMembers.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filteredMembers.length)}</b> of <b>{filteredMembers.length}</b> members</span><div className="pagination"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /></button>{Array.from({ length: Math.min(pageCount, 3) }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} className={page === pageNumber ? 'page-current' : ''} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}{pageCount > 3 && <><span>...</span><button onClick={() => setPage(pageCount)}>{pageCount}</button></>}<button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}><ChevronRight size={16} /></button></div></div>
            </section>

            <aside className="member-detail">
              <div className="detail-top"><div className="detail-kicker"><span>MEMBER PROFILE</span><button className="row-more" aria-label="More profile actions"><MoreHorizontal size={18} /></button></div><div className="detail-identity"><div className={`avatar avatar-large avatar-${selectedMember?.color ?? 'mint'}`}>{selectedMember?.initials}</div><h2>{selectedMember?.name}</h2><p>{selectedMember?.role} <span>·</span> {selectedMember?.recordCode ?? selectedMember?.id}</p><span className={`status status-${selectedMember?.status.toLowerCase()}`}><i />{selectedMember?.status}</span></div>
                <div className="detail-actions"><button onClick={() => notify('Secure messaging will be available when connected')}><MessageSquareText size={15} /> Message</button><button onClick={beginEdit}><Settings size={15} /> Edit profile</button></div>
                <div className="detail-section"><div className="section-label">CONTACT DETAILS</div><div className="detail-field"><span>Email address</span><b>{selectedMember?.email}</b></div><div className="detail-field"><span>Phone number</span><b>{selectedMember?.phone}</b></div><div className="detail-field"><span>Household</span><b className="detail-family"><Users size={14} />{selectedMember?.family}</b></div><div className="detail-field"><span>Member since</span><b>{selectedMember?.joined}</b></div></div>
                <div className="detail-section attendance-detail"><div className="section-label">ATTENDANCE <button onClick={() => setActivePage('Attendance')}>View history <ChevronRight size={12} /></button></div><div className="attendance-summary"><div><b>{selectedMember ? `${attendanceEvents.filter((event) => event.memberIds.includes(selectedMember.id)).length}` : '0'}<span>/{supabaseConfigured ? attendanceEvents.length : '10'}</span></b><small>Recent gatherings</small></div><div className="mini-bars" aria-label="Recent attendance">{(supabaseConfigured ? attendanceEvents : []).slice().reverse().map((event, index) => <i key={event.id} style={{ height: `${event.memberIds.includes(selectedMember?.id ?? '') ? 88 : 25}%` }} className={index === attendanceEvents.length - 1 ? 'bar-current' : ''} />)}{!supabaseConfigured && [68, 92, 75, 100, 83, 91, 55, 100, 82, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} className={index === 9 ? 'bar-current' : ''} />)}</div></div></div>
                <div className="detail-section notes-detail"><div className="section-label">PRIVATE NOTES <span>{selectedMember?.notes.length ?? 0}</span></div>{selectedMember?.notes.slice(0, 2).map((note, index) => <div className="note-item" key={`${note}-${index}`}><span className="note-dot" /><p>{note}<small>{displayName} · recent</small></p></div>)}{canWriteNotes && <form className="note-form" onSubmit={addNote}><input aria-label="Add a private note" placeholder="Add a private note..." value={noteText} onChange={(event) => setNoteText(event.target.value)} /><button aria-label="Save note" type="submit"><Plus size={16} /></button></form>}<small className="private-hint"><ShieldCheck size={12} /> {canWriteNotes ? 'Only administrators can see notes' : 'Private notes are restricted to administrators'}</small></div>
              </div>
            </aside>
          </>}

          <footer className="page-footer"><span>Church Records <span className="footer-dot">·</span> A caring community starts with connection.</span><span><ShieldCheck size={13} /> Private and secure</span></footer>
        </div>
      </main>

      {showAdd && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false) }}><form className="add-modal" onSubmit={addMember}><div className="modal-head"><div className="modal-icon"><Users size={19} /></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setShowAdd(false)}><X size={19} /></button></div><h2>Add a member</h2><p>Create a profile in the {membership?.churchName ?? 'Harbor Community'} directory.</p><label>Full name<input required autoFocus placeholder="e.g. Alex Morgan" value={newName} onChange={(event) => setNewName(event.target.value)} /></label><label>Email address <span className="optional">Optional</span><input type="email" placeholder="alex@example.com" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><div className="form-security"><ShieldCheck size={15} /> This record is visible to authorized administrators only.</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="button button-primary"><Plus size={16} /> Create profile</button></div></form></div>}
      {showEdit && selectedMember && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEdit(false) }}><form className="add-modal" onSubmit={saveMemberChanges}><div className="modal-head"><div className="modal-icon"><Users size={19} /></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setShowEdit(false)}><X size={19} /></button></div><h2>Edit member profile</h2><p>Update {selectedMember.name}'s directory details.</p><label>Full name<input required autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} /></label><label>Email address<input type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} /></label><label>Phone number<input type="tel" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} /></label><label>Member status<select value={editStatus} onChange={(event) => setEditStatus(event.target.value as Member['status'])}><option>Active</option><option>Visitor</option><option>Inactive</option></select></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowEdit(false)}>Cancel</button><button type="submit" className="button button-primary"><Check size={16} /> Save changes</button></div></form></div>}
      {showAttendance && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAttendance(false) }}><form className="add-modal attendance-modal" onSubmit={saveAttendance}><div className="modal-head"><div className="modal-icon"><CalendarDays size={19} /></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setShowAttendance(false)}><X size={19} /></button></div><h2>Record attendance</h2><p>Save a gathering and the members who were present.</p><label>Gathering name<input required value={attendanceType} onChange={(event) => setAttendanceType(event.target.value)} /></label><label>Gathering date<input required type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label><div className="attendee-select-head"><b>Present members</b><button type="button" onClick={() => setAttendingIds(attendingIds.length === members.length ? [] : members.map((member) => member.id))}>{attendingIds.length === members.length ? 'Clear all' : 'Select all'}</button></div><div className="attendee-list">{members.map((member) => <label className="attendee-option" key={member.id}><input type="checkbox" checked={attendingIds.includes(member.id)} onChange={(event) => setAttendingIds((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} /><span className={`avatar avatar-${member.color}`}>{member.initials}</span><span>{member.name}</span><small>{member.family}</small></label>)}</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowAttendance(false)}>Cancel</button><button type="submit" className="button button-primary"><Check size={16} /> Save attendance</button></div></form></div>}
      {ocrDocument && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOcrDocument(null) }}><section className="add-modal ocr-modal" role="dialog" aria-modal="true" aria-labelledby="ocr-title"><div className="modal-head"><div className="modal-icon"><Sparkles size={19} /></div><button type="button" className="icon-button" aria-label="Close extracted text" onClick={() => setOcrDocument(null)}><X size={19} /></button></div><h2 id="ocr-title">Extracted text</h2><p>{ocrDocument.name} · {ocrDocument.memberName}</p>{ocrDocument.ocrText ? <pre className="ocr-text">{ocrDocument.ocrText}</pre> : <div className="empty-state"><FileText size={22} /><b>No text was detected</b><span>The scan may be blank or difficult to read.</span></div>}</section></div>}
      {toast && <div className="toast"><span><Check size={15} /></span>{toast}</div>}
      <input className="hidden-input" id="document-upload" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { void handleDocument(event.target.files?.[0]); event.currentTarget.value = '' }} />
    </div>
  )
}

function formatAttendanceDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pageDescription(page: string) {
  const descriptions: Record<string, string> = {
    Overview: 'A clear picture of the people and rhythms in your community.',
    Families: 'Households, relationships, and the people who belong together.',
    Attendance: 'A gentle pulse on gathering together week by week.',
    Documents: 'Keep important records organized and within reach.',
    Notes: 'Private follow-ups and care notes for your team.',
  }
  return descriptions[page] ?? 'A thoughtful place to care for your community.'
}

function StatCard({ icon, title, value, trend, accent }: { icon: React.ReactNode; title: string; value: string; trend: string; accent: string }) {
  return <div className="stat-card"><div className="stat-top"><span className={`stat-icon stat-${accent}`}>{icon}</span><span className="stat-menu"><MoreHorizontal size={17} /></span></div><div className="stat-value">{value}</div><div className="stat-title">{title}</div><div className="stat-trend"><Activity size={12} />{trend}</div></div>
}

function AttendanceView({ events, demo, memberCount, canManage, onRecord }: { events: AttendanceEvent[]; demo: boolean; memberCount: number; canManage: boolean; onRecord: () => void }) {
  const chartEvents = demo ? [] : [...events].reverse()
  const maxCount = Math.max(memberCount, ...chartEvents.map((event) => event.presentCount), 1)
  const average = chartEvents.length ? Math.round(chartEvents.reduce((sum, event) => sum + event.presentCount, 0) / chartEvents.length) : 0
  const latestCount = chartEvents.at(-1)?.presentCount ?? 0
  const dateRange = chartEvents.length
    ? `${formatAttendanceDate(chartEvents[0].date)} – ${formatAttendanceDate(chartEvents.at(-1)!.date)}`
    : 'No gatherings recorded yet'
  return <section className="directory-panel secondary-view"><div className="panel-head"><div><h2>Sunday gathering</h2><p>{demo ? 'Weekly attendance overview · Preview data' : `Attendance history · ${dateRange}`}</p></div><div className="attendance-actions">{demo && <button className="button button-outline"><CalendarDays size={15} /> This month <ChevronDown size={14} /></button>}{canManage && <button className="button button-primary" onClick={onRecord}><Plus size={15} /> Record attendance</button>}</div></div><div className="attendance-chart"><div className="chart-y"><span>{demo ? '800' : maxCount}</span><span>{demo ? '600' : Math.round(maxCount * .75)}</span><span>{demo ? '400' : Math.round(maxCount * .5)}</span><span>{demo ? '200' : Math.round(maxCount * .25)}</span><span>0</span></div><div className="chart-body"><div className="chart-grid"><i /><i /><i /><i /><i /></div><div className="chart-columns">{demo ? [['Sep 1', 58], ['Sep 8', 72], ['Sep 15', 63], ['Sep 22', 88], ['Sep 29', 79]].map(([label, height]) => <div className="chart-column" key={label}><span className="chart-bar" style={{ height: `${height}%` }} /><small>{label}</small></div>) : chartEvents.map((event) => <div className="chart-column" key={event.id}><span className="chart-bar" style={{ height: `${Math.max(4, event.presentCount / maxCount * 100)}%` }} /><small>{formatAttendanceDate(event.date)}</small></div>)}</div>{!demo && chartEvents.length === 0 && <div className="attendance-empty">Attendance events will appear here when recorded.</div>}</div></div><div className="attendance-totals"><div><span>Average attendance</span><b>{demo ? '684' : average.toLocaleString()} <small>people</small></b></div><div><span>Members present</span><b>{demo ? '72%' : `${memberCount ? Math.round(latestCount / memberCount * 100) : 0}%`} <small>of active members</small></b></div><div><span>Gatherings recorded</span><b>{demo ? '5' : events.length} <small>recent events</small></b></div></div></section>
}

function FamiliesView({ members, onSelect }: { members: Member[]; onSelect: (id: string) => void }) {
  const families = Array.from(new Map(members.map((member) => [member.family, members.filter((person) => person.family === member.family)])).entries())
  return <section className="directory-panel secondary-view"><div className="panel-head"><div><h2>Households</h2><p>Family groups help keep relationships connected.</p></div><button className="button button-outline"><SlidersHorizontal size={15} /> Filter</button></div><div className="family-grid">{families.slice(0, 6).map(([family, people]) => <button className="family-card" key={family} onClick={() => onSelect(people[0].id)}><div className="family-card-head"><div className="family-icon"><Home size={18} /></div><MoreHorizontal size={17} /></div><b>{family}</b><span>{people.length} {people.length === 1 ? 'member' : 'members'}</span><div className="family-people">{people.slice(0, 4).map((person) => <span className={`avatar avatar-${person.color}`} key={person.id}>{person.initials}</span>)}</div><div className="family-card-foot">{people.slice(0, 2).map((person) => person.name.split(' ')[0]).join(' & ')} <ChevronRight size={14} /></div></button>)}</div></section>
}

function DocumentsView({ documents, demo, canUpload, selectedMemberName, onOpen, onViewOcr }: { documents: DocumentRecord[]; demo: boolean; canUpload: boolean; selectedMemberName?: string; onOpen: (documentId: string) => void; onViewOcr: (documentId: string) => void }) {
  const previewDocuments = [
    { id: 'membership-form', name: 'Membership form', memberName: 'Eleanor Pena', createdAt: '2024-09-22', mimeType: 'application/pdf', ocrStatus: 'pending' as const, ocrText: null },
    { id: 'baptism-certificate', name: 'Baptism certificate', memberName: 'Cody Fisher', createdAt: '2024-09-18', mimeType: 'image/jpeg', ocrStatus: 'pending' as const, ocrText: null },
    { id: 'visitor-card', name: 'Visitor card', memberName: 'Jenny Wilson', createdAt: '2024-09-15', mimeType: 'image/png', ocrStatus: 'completed' as const, ocrText: null },
    { id: 'child-dedication', name: 'Child dedication', memberName: 'Esther Howard', createdAt: '2024-09-08', mimeType: 'application/pdf', ocrStatus: 'pending' as const, ocrText: null },
  ]
  const records = demo ? previewDocuments : documents
  return <section className="directory-panel secondary-view"><div className="panel-head"><div><h2>Church documents</h2><p>Private files linked to member profiles.</p></div>{canUpload && <label htmlFor="document-upload" className="button button-primary upload-trigger"><Upload size={16} /> Upload document</label>}</div>{canUpload && <label htmlFor="document-upload" className="drop-zone"><div className="drop-icon"><FileImage size={21} /></div><b>Scan or upload a document</b><span>{selectedMemberName ? `Linked to ${selectedMemberName}` : 'Choose a member before uploading'} · PDF, JPG, PNG, or WebP · Up to 12 MB</span><span className="capture-link"><FileImage size={14} /> On mobile, capture with camera</span></label>}<div className="document-list">{records.map((document) => { const kind = document.mimeType === 'application/pdf' ? 'PDF' : 'IMAGE'; const date = new Date(`${document.createdAt.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }); return <div className="document-row" key={document.id}><button className="document-row-button" onClick={() => !demo && onOpen(document.id)} disabled={demo} aria-label={`${demo ? 'Preview' : 'Open private document'} ${document.name}`}><span className={`doc-type doc-${kind.toLowerCase()}`}><FileText size={18} /></span><span className="document-row-name"><b>{document.name}</b><small>{document.memberName} · {date}</small></span></button><span className={`doc-tag tag-${document.ocrStatus}`}>{document.ocrStatus === 'completed' ? <><Sparkles size={11} /> OCR processed</> : document.ocrStatus.replace('_', ' ')}</span>{document.ocrStatus === 'completed' && !demo && <button className="row-more" aria-label={`View extracted text from ${document.name}`} title="View extracted text" onClick={() => onViewOcr(document.id)}><Sparkles size={15} /></button>}</div> })}{records.length === 0 && <div className="empty-state"><FileText size={22} /><b>No documents yet</b><span>Privately uploaded member documents will appear here.</span></div>}</div></section>
}

function NotesView({ members, onSelect }: { members: Member[]; onSelect: (id: string) => void }) {
  const notes = members.flatMap((member) => member.notes.map((note) => ({ member, note }))).slice(0, 6)
  return <section className="directory-panel secondary-view"><div className="panel-head"><div><h2>Recent private notes</h2><p>Care notes are visible only to workspace administrators.</p></div><span className="private-chip"><ShieldCheck size={13} /> PRIVATE</span></div><div className="notes-list">{notes.map(({ member, note }, index) => <button className="note-row" key={`${member.id}-${index}`} onClick={() => onSelect(member.id)}><div className="note-row-icon"><MessageSquareText size={16} /></div><div><b>{note}</b><span>{member.name} <i>·</i> Private member note</span></div><ChevronRight size={16} /></button>)}</div>{notes.length === 0 && <div className="empty-state"><MessageSquareText size={22} /><b>No private notes yet</b><span>Administrator notes linked to member profiles will appear here.</span></div>}</section>
}

export default App
