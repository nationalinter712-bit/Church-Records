import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttendanceEvent, ChurchMembership, DocumentRecord, Member, MemberStatus } from './types'

const avatarColors = ['lilac', 'peach', 'blue', 'green', 'yellow', 'pink', 'mint', 'lavender']

export async function getChurchMembership(client: SupabaseClient, userId: string): Promise<ChurchMembership> {
  const { data, error } = await client
    .from('church_memberships')
    .select('church_id, role, churches(name)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Your account is not assigned to a church workspace.')
  const church = Array.isArray(data.churches) ? data.churches[0] : data.churches
  return {
    churchId: data.church_id,
    churchName: church?.name ?? 'Church workspace',
    role: data.role,
  }
}

export async function listMembers(client: SupabaseClient, churchId: string): Promise<Member[]> {
  const [memberResult, noteResult] = await Promise.all([
    client.from('members')
      .select('id, record_code, first_name, last_name, email, phone, membership_status, joined_at, member_role, family_id, families(name)')
      .eq('church_id', churchId)
      .is('archived_at', null)
      .order('last_name', { ascending: true }),
    client.from('member_notes')
      .select('member_id, content, created_at')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false }),
  ])

  if (memberResult.error) throw memberResult.error
  if (noteResult.error) throw noteResult.error

  const notesByMember = new Map<string, string[]>()
  for (const note of noteResult.data) {
    const notes = notesByMember.get(note.member_id) ?? []
    if (notes.length < 3) notes.push(note.content)
    notesByMember.set(note.member_id, notes)
  }

  return memberResult.data.map((row, index) => {
    const family = Array.isArray(row.families) ? row.families[0] : row.families
    const name = `${row.first_name} ${row.last_name}`.trim()
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    const status = row.membership_status === 'active' ? 'Active' : row.membership_status === 'visitor' ? 'Visitor' : 'Inactive'
    return {
      id: row.id,
      recordCode: row.record_code,
      name,
      email: row.email ?? 'No email added',
      phone: row.phone ?? 'No phone added',
      family: family?.name ?? 'Unassigned household',
      role: row.member_role ?? 'Member',
      joined: row.joined_at
        ? new Date(`${row.joined_at}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        : 'Not recorded',
      status: status as MemberStatus,
      initials,
      color: avatarColors[index % avatarColors.length],
      lastSeen: 'Not recorded',
      notes: notesByMember.get(row.id) ?? [],
    }
  })
}

export async function listAttendanceEvents(client: SupabaseClient, churchId: string): Promise<AttendanceEvent[]> {
  const { data, error } = await client.from('attendance_events')
    .select('id, event_date, event_type, attendance_records(member_id, status)')
    .eq('church_id', churchId)
    .order('event_date', { ascending: false })
    .limit(10)
  if (error) throw error

  return data.map((event) => {
    const records = Array.isArray(event.attendance_records) ? event.attendance_records : []
    const present = records.filter((record) => record.status === 'present')
    return {
      id: event.id,
      date: event.event_date,
      type: event.event_type,
      presentCount: present.length,
      memberIds: present.map((record) => record.member_id),
    }
  })
}

export async function listDocuments(client: SupabaseClient, churchId: string): Promise<DocumentRecord[]> {
  const { data, error } = await client.from('documents')
    .select('id, member_id, storage_path, original_file_name, created_at, mime_type, ocr_status, ocr_text, members(first_name, last_name)')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error

  return data.map((document) => {
    const member = Array.isArray(document.members) ? document.members[0] : document.members
    return {
      id: document.id,
      memberId: document.member_id,
      storagePath: document.storage_path,
      name: document.original_file_name,
      memberName: member ? `${member.first_name} ${member.last_name}`.trim() : 'Unlinked document',
      createdAt: document.created_at,
      mimeType: document.mime_type,
      ocrStatus: document.ocr_status,
      ocrText: document.ocr_text,
    }
  })
}

export async function createMember(client: SupabaseClient, churchId: string, name: string, email: string) {
  const [firstName, ...lastNameParts] = name.trim().split(/\s+/)
  const { data, error } = await client.from('members').insert({
    church_id: churchId,
    first_name: firstName,
    last_name: lastNameParts.join(' ') || firstName,
    email: email || null,
    membership_status: 'visitor',
  }).select('id, record_code').single()
  if (error) throw error
  return { id: data.id as string, recordCode: data.record_code as string }
}

export async function createMemberNote(client: SupabaseClient, churchId: string, memberId: string, content: string) {
  const { error } = await client.from('member_notes').insert({
    church_id: churchId,
    member_id: memberId,
    content,
    visibility: 'administrators',
  })
  if (error) throw error
}

export async function uploadMemberDocument(client: SupabaseClient, churchId: string, memberId: string, file: File) {
  const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
  const storagePath = `${churchId}/${memberId}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await client.storage.from('church-documents').upload(storagePath, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await client.from('documents').insert({
    church_id: churchId,
    member_id: memberId,
    storage_path: storagePath,
    original_file_name: file.name,
    mime_type: file.type,
    byte_size: file.size,
    ocr_status: 'pending',
  }).select('id').single()

  if (error) {
    await client.storage.from('church-documents').remove([storagePath])
    throw error
  }
  return data.id as string
}

export async function runDocumentOcr(accessToken: string, documentId: string) {
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ documentId }),
  })
  const result = await response.json().catch(() => ({})) as { error?: string; text?: string }
  if (!response.ok) throw new Error(result.error ?? 'OCR processing failed.')
  return result.text ?? ''
}

export async function updateMember(client: SupabaseClient, churchId: string, memberId: string, values: { name: string; email: string; phone: string; status: MemberStatus }) {
  const [firstName, ...lastNameParts] = values.name.trim().split(/\s+/)
  const { error } = await client.from('members').update({
    first_name: firstName,
    last_name: lastNameParts.join(' ') || firstName,
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    membership_status: values.status.toLowerCase(),
  }).eq('id', memberId).eq('church_id', churchId)
  if (error) throw error
}

export async function getPrivateDocumentUrl(client: SupabaseClient, storagePath: string) {
  const { data, error } = await client.storage.from('church-documents').createSignedUrl(storagePath, 60)
  if (error) throw error
  return data.signedUrl
}

export async function createAttendanceEvent(client: SupabaseClient, churchId: string, date: string, type: string, memberIds: string[]) {
  const { data, error } = await client.rpc('record_attendance_event', {
    target_church_id: churchId,
    target_event_date: date,
    target_event_type: type,
    present_member_ids: [...new Set(memberIds)],
  })
  if (error) throw error
  return data as string
}