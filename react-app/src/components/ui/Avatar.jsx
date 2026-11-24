import React from 'react';

// Round profile picture. Decorative by default (the name is always printed
// next to it); pass `name` to give it a text alternative when it stands alone.
export default function Avatar({ user, size, name }) {
    const url = user?.profilePicture || '/images/default-avatar.svg';
    const className = `avatar${size ? ` avatar--${size}` : ''}`;
    return <img className={className} src={url} alt={name || ''} loading="lazy" decoding="async" />;
}
