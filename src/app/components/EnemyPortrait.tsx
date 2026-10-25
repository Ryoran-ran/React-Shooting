import type { EnemyKind } from '../../game/entities/Enemy';

/** Small editor thumbnails echo the silhouettes and colours used in the game. */
export function EnemyPortrait({ kind }: { kind: EnemyKind }) {
  return <svg className={`enemy-portrait editor-kind-${kind}`} viewBox="0 0 48 48" aria-hidden="true">
    {kind === 'small' && <>
      <path d="M10 25C9 14 16 8 24 8s15 6 14 17c-4 4-8 5-14 3-6 2-10 1-14-3Z" fill="currentColor" />
      <path d="M15 28c-3 6 3 7 0 12m7-11c-3 5 3 7 0 11m7-11c-3 5 3 7 0 11m7-12c-3 6 3 7 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 19c2-5 6-7 10-7" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
    </>}
    {kind === 'medium' && <>
      <path d="M24 3l4 7 7-3 1 8 8 2-5 7 5 7-8 2-1 8-7-3-4 7-4-7-7 3-1-8-8-2 5-7-5-7 8-2 1-8 7 3Z" fill="currentColor" />
      <circle cx="24" cy="24" r="14" fill="#ead6a5" opacity=".9" />
      <circle cx="19" cy="20" r="1.6" fill="#514b45" /><circle cx="29" cy="20" r="1.6" fill="#514b45" />
    </>}
    {kind === 'turret' && <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) =>
        <ellipse key={angle} cx="24" cy="10" rx="4" ry="10" fill="currentColor" transform={`rotate(${angle} 24 24)`} />)}
      <circle cx="24" cy="24" r="10" fill="#e5b6b2" /><circle cx="24" cy="24" r="4" fill="#704e68" />
    </>}
    {kind === 'rusher' && <>
      <path d="M24 5 10 27h28L24 5Z" fill="currentColor" />
      <rect x="15" y="20" width="18" height="13" rx="6" fill="#d8c6ed" />
      <path d="M17 32c-5 5 2 6-3 11m10-10c-4 5 3 6 0 11m8-12c-3 5 4 6 3 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>}
    {kind === 'large' && <>
      <path d="M24 10C12 8 11 16 2 14c3 17 13 20 22 16 9 4 19 1 22-16-9 2-10-6-22-4Z" fill="currentColor" />
      <path d="M24 29c-3 5-3 10 0 15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 20c4 3 7 4 10 4 3 0 6-1 10-4" fill="none" stroke="#d9e3f2" strokeOpacity=".8" strokeWidth="2" />
    </>}
    {kind === 'boss' && <circle cx="24" cy="24" r="17" fill="currentColor" />}
  </svg>;
}
