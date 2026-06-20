// import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
// import { API_CONFIG, TIDAL_CONFIG } from "./config";

// export const exchangeTidalCodeForToken = async (
//   code: string,
//   code_verifier: string,
//   state: string,
// ) => {
//   try {
//     const payload = {
//       code,
//       redirect_uri: TIDAL_CONFIG.REDIRECT_URI,
//       code_verifier,
//       state,
//     };

//     const data = await axiosWrapper<any>(
//       axiosInstance.post(API_CONFIG.ENDPOINTS.TIDAL_AUTH_TOKEN, payload),
//     );

//     if (data.success === true) return data;
//     return {
//       success: false,
//       error: data.error || "Failed to exchange code for token.",
//       details: data.details ?? null,
//     };
//   } catch (error) {
//     return handleApiError(error as Error);
//   }
// };

// export const transferPlaylistToTidal = async (
//   playlist_id: string,
//   access_token: string,
//   playlist_name?: string,
// ) => {
//   try {
//     const payload = {
//       playlist_id,
//       access_token,
//       custom_playlist_name: playlist_name || undefined,
//     };

//     const data = await axiosWrapper<any>(
//       axiosInstance.post(API_CONFIG.ENDPOINTS.TIDAL_TRANSFER, payload),
//     );

//     if (data.success === true) return data;
//     return {
//       success: false,
//       error: data.error || "Failed to transfer playlist to Tidal.",
//       details: data.details ?? null,
//     };
//   } catch (error) {
//     return handleApiError(error as Error);
//   }
// };
