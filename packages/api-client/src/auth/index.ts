// Export all auth functions
export { register } from './register';
export { login } from './login';
export { loginWithGoogle } from './google';
export { verify2FA } from './verify2FA';
export { verifyEmail, resendVerification } from './verifyEmail';
export { requestPasswordReset, confirmPasswordReset } from './passwordReset';
export { logout, logoutAll } from './logout';
export { refreshAccessToken } from './refresh';
export {
  getMyProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} from './profile';
export { getMySessions, revokeSession } from './sessions';
export { enable2FA, disable2FA } from './twoFactor';

