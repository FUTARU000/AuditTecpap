export interface ProcessAssignmentDto {
  id: string;
  processId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  role: string;
  createdAt: string;
}

export interface CreateAssignmentDto {
  userId: string;
  role: string;
}
