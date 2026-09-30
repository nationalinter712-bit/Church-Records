export type MemberStatus = 'Active' | 'Visitor' | 'Inactive'

export type Member = {
  id: string
  recordCode?: string
  name: string
  email: string
  phone: string
  family: string
  role: string
  joined: string
  status: MemberStatus
  initials: string
  color: string
  lastSeen: string
  notes: string[]
}

export type ChurchMembership = {
  churchId: string
  churchName: string
  role: 'owner' | 'admin' | 'pastor' | 'staff' | 'viewer'
}

export type AttendanceEvent = {
  id: string
  date: string
  type: string
  presentCount: number
  memberIds: string[]
}

export type DocumentRecord = {
  id: string
  memberId: string | null
  storagePath: string
  name: string
  memberName: string
  createdAt: string
  mimeType: string
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'not_supported'
  ocrText: string | null
}