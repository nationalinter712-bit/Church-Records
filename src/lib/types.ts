export type MemberStatus = 'Active' | 'Visitor' | 'Inactive'

export type MemberProfileDetails = {
  address?: string
  dateFiled?: string | null
  contactNumber?: string
  gender?: string
  birthdate?: string | null
  citizenship?: string
  birthplace?: string
  civilStatus?: string
  spouse?: string
  children?: string[]
  father?: string
  mother?: string
  emergencyContactPerson?: string
  emergencyContactPhone?: string
  elementarySchool?: string
  highSchool?: string
  college?: string
  degreeCourse?: string
  dateOfSalvation?: string | null
  dateOfBaptism?: string | null
  dateOfMembership?: string | null
  currentChurchPosition?: string
  ministryInterests?: string[]
  otherSkills?: string
  specialSkills?: string
}

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
  profile: MemberProfileDetails
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

export type DocumentSource = 'upload' | 'scan'

export type DocumentRecord = {
  id: string
  memberId: string | null
  storagePath: string
  name: string
  memberName: string
  createdAt: string
  mimeType: string
  source: DocumentSource
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'not_supported'
  ocrText: string | null
}