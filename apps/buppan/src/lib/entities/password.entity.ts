/**
 * Password change entity
 */

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordChangeResult {
  success: boolean;
}
