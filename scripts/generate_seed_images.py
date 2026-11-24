"""
Generates the SVG artwork used by the demo data (A36). Everything here is
drawn by this script, so the project owns every image: no photos, no
third-party hosting.

    python scripts/generate_seed_images.py

writes react-app/public/images/{default-avatar.svg, seed/...}. Re-running gives
byte-identical files (fixed random seeds).
"""
import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), '..', 'react-app', 'public', 'images')

# (background, contour line, route line, dot)
PALETTES = [
    ('#E9E7FF', '#C9C4FF', '#3B2FD9', '#1B1553'),   # lavender
    ('#DFF3EE', '#B5DDD3', '#0B6B5E', '#0A3F38'),   # glacier
    ('#FBE9E3', '#F2C8BA', '#B4401F', '#5C1F0E'),   # clay
    ('#E4EEFB', '#BFD4F2', '#1F5FBF', '#0F2F60'),   # sky
    ('#F1EAD9', '#DDD0AE', '#6B5410', '#35290A'),   # sand
    ('#EDE4F5', '#D5C3E8', '#6A2BA0', '#341450'),   # plum
]


def contours(rng, width, height, rings=14):
    """Closed, wobbly rings around one or two hill tops (like a topographic map)."""
    paths = []
    for _ in range(rng.choice([1, 2])):
        cx, cy = rng.uniform(0.2, 0.8) * width, rng.uniform(0.25, 0.75) * height
        waves = [(k, rng.uniform(0.04, 0.11), rng.uniform(0, 6.28)) for k in (2, 3, 5)]
        for i in range(1, rings + 1):
            base = 28 * i
            pts = []
            for step in range(90):
                a = step / 90 * 2 * math.pi
                r = base * (1 + sum(amp * math.sin(k * a + ph) for k, amp, ph in waves))
                pts.append((cx + r * 1.25 * math.cos(a), cy + r * math.sin(a)))
            paths.append('M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z')
    return paths


def trail(rng, width, height):
    """A smooth trail from lower left to upper right with a few bends."""
    pts = [(0.12 * width, rng.uniform(0.65, 0.85) * height)]
    for i in range(1, 5):
        pts.append((width * (0.12 + 0.76 * i / 4), rng.uniform(0.2, 0.8) * height))
    d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f}'
    for i in range(1, len(pts)):
        (x0, y0), (x1, y1) = pts[i - 1], pts[i]
        mx = (x0 + x1) / 2
        d += f' C{mx:.1f} {y0:.1f} {mx:.1f} {y1:.1f} {x1:.1f} {y1:.1f}'
    return d, pts[0], pts[-1]


def art(seed, kind):
    rng = random.Random(seed)
    bg, line, route, dot = PALETTES[seed % len(PALETTES)]
    w, h = 800, 600
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="Decorative map artwork">',
             f'<rect width="{w}" height="{h}" fill="{bg}"/>']
    for d in contours(rng, w, h):
        parts.append(f'<path d="{d}" fill="none" stroke="{line}" stroke-width="2"/>')
    d, start, end = trail(rng, w, h)
    if kind == 'workout':
        # a pulse line under the trail: effort over time
        pulse = 'M0 540 ' + ' '.join(f'L{x} {540 - rng.randint(8, 70)}' for x in range(40, 801, 40))
        parts.append(f'<path d="{pulse}" fill="none" stroke="{route}" stroke-opacity="0.25" stroke-width="6" stroke-linejoin="round"/>')
    parts.append(f'<path d="{d}" fill="none" stroke="{bg}" stroke-width="16" stroke-linecap="round"/>')
    parts.append(f'<path d="{d}" fill="none" stroke="{route}" stroke-width="8" stroke-linecap="round"/>')
    parts.append(f'<circle cx="{start[0]:.1f}" cy="{start[1]:.1f}" r="14" fill="{route}" stroke="{bg}" stroke-width="5"/>')
    parts.append(f'<circle cx="{end[0]:.1f}" cy="{end[1]:.1f}" r="14" fill="{bg}" stroke="{dot}" stroke-width="6"/>')
    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


def avatar(initials, seed):
    bg, line, route, dot = PALETTES[seed % len(PALETTES)]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="{initials} avatar">'
            f'<rect width="256" height="256" fill="{route}"/>'
            f'<circle cx="256" cy="0" r="150" fill="{dot}" fill-opacity="0.35"/>'
            f'<circle cx="0" cy="256" r="110" fill="#FFFFFF" fill-opacity="0.14"/>'
            f'<text x="128" y="152" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" '
            f'font-size="96" font-weight="700" fill="#FFFFFF">{initials}</text></svg>\n')


DEFAULT_AVATAR = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Default profile picture">'
    '<rect width="256" height="256" fill="#E9E7FF"/>'
    '<circle cx="128" cy="100" r="46" fill="#3B2FD9"/>'
    '<path d="M36 256c0-56 40-92 92-92s92 36 92 92z" fill="#3B2FD9"/>'
    '</svg>\n')

PROFILES = {'demo': ('DU', 0), 'marnie': ('MD', 1), 'bobbie': ('BS', 3), 'jimmy': ('JN', 2), 'tammie': ('TL', 5)}


def write(path, text):
    full = os.path.normpath(os.path.join(OUT, path))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w') as f:
        f.write(text)


if __name__ == '__main__':
    write('default-avatar.svg', DEFAULT_AVATAR)
    for name, (initials, seed) in PROFILES.items():
        write(f'seed/profile/{name}.svg', avatar(initials, seed))
    for i in range(1, 21):
        write(f'seed/routes/{i}.svg', art(100 + i, 'route'))
    for i in range(1, 11):
        write(f'seed/workouts/{i}.svg', art(200 + i, 'workout'))
    print('wrote', 1 + len(PROFILES) + 20 + 10, 'files to', os.path.normpath(OUT))
