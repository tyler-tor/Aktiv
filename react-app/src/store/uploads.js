import { csrfFetch } from './csrf';
// Image upload helper shared by the sign-up, new route and new workout pages.

// Must match MAX_CONTENT_LENGTH in app/config.py.
export const MAX_UPLOAD_MB = 5;
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

// Returns an error message for a file we should not even try to upload, or null.
export const checkImageFile = (file) => {
    if (!file) return 'Please choose an image first.';
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Only PNG, JPG, GIF or WebP images are allowed.';
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Image is too large (max ${MAX_UPLOAD_MB} MB).`;
    return null;
};

// Uploads a File to /api/img/upload. Resolves to { url } or { error }.
export const uploadImage = async (file) => {
    const problem = checkImageFile(file);
    if (problem) return { error: problem };

    const formData = new FormData();
    formData.append('image', file);
    let res;
    try {
        res = await csrfFetch('/api/img/upload', { method: 'POST', body: formData });
    } catch (e) {
        return { error: 'Upload failed. Check your connection and try again.' };
    }
    let data = {};
    try {
        data = await res.json();
    } catch (e) {
        // non-JSON error page
    }
    if (res.ok && data.url) return { url: data.url };
    if (res.status === 401) return { error: 'Please log in to upload images.' };
    if (res.status === 413) return { error: `Image is too large (max ${MAX_UPLOAD_MB} MB).` };
    return { error: typeof data.errors === 'string' ? data.errors : 'Upload failed. Please try again.' };
};

// Sets the logged-in user's profile picture to an uploaded image URL.
export const setProfilePicture = async (url) => {
    const res = await csrfFetch('/api/auth/profile-picture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_picture: url }),
    });
    return res.ok;
};
