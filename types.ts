export interface Attachment {
  type: 'image' | 'video' | 'audio';
  mimeType: string;
  url: string; // For UI display (blob or data URI)
  base64Data?: string; // For API transmission (raw base64)
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: Date;
  isError?: boolean;
  toolCallId?: string;
  attachments?: Attachment[];
}

export enum LoadingState {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  EXECUTING_TOOL = 'EXECUTING_TOOL',
}

export interface TicketData {
  created_at: string;
  requester_name: string;
  requester_email: string;
  location_name: string;
  location_id?: string | null;
  area: string;
  severity: string;
  subject: string;
  description: string;
  steps_to_reproduce: string;
  expected_result: string;
  actual_result: string;
  error_text?: string | null;
  attachments: string; // JSON string
  priority_score: number;
  status: string;
  unyra_task_id?: string | null;
  task_error?: string | null;
}

export interface UnyraTaskData {
  locationId?: string | null;
  assignedTo?: string | null;
  dueDate?: string | null;
  tags: string[];
  title: string;
  description: string;
  severity: string;
  area: string;
  priority_score: number;
  sheet_ticket_id: string;
  requester_email: string;
  metadata?: {
    location_name: string;
    expected_result: string;
    actual_result: string;
    error_text?: string | null;
  };
}

export interface SubAccount {
  id: string;
  name: string;
  email: string; // Admin email for this account
  plan: string;
  status: 'active' | 'churned' | 'past_due';
}

export type UserRole = 'admin' | 'client';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  assignedLocationId?: string; // Only for clients
}

// Responses from the mock APIs
export interface GoogleSheetResponse {
  ok: boolean;
  row_id: string;
  ticket_id: string;
  sheet_url: string;
}

export interface UnyraTaskResponse {
  ok: boolean;
  unyra_task_id: string;
  task_url?: string;
  error?: string;
}