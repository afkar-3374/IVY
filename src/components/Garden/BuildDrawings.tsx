import React from 'react';

/**
 * SVG drawings for buildable garden items. Each is drawn around a local origin at its
 * ground contact point (0,0), extending upwards. `night` brightens lights.
 * Shared gradients are defined once in <BuildDefs />.
 */

export const BuildDefs: React.FC = () => (
  <>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C88B5A" /><stop offset="100%" stopColor="#8A5733" /></linearGradient>
    <linearGradient id="woodLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E3B07D" /><stop offset="100%" stopColor="#B07646" /></linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFF7EE" /><stop offset="100%" stopColor="#F1DCC7" /></linearGradient>
    <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F27A93" /><stop offset="100%" stopColor="#B8385A" /></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A7E2F7" /><stop offset="100%" stopColor="#4BA9D6" /></linearGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F4F1F6" /><stop offset="100%" stopColor="#C9C1D3" /></linearGradient>
    <radialGradient id="warmGlow"><stop offset="0%" stopColor="#FFE7A3" stopOpacity="0.95" /><stop offset="100%" stopColor="#FFE7A3" stopOpacity="0" /></radialGradient>
    <linearGradient id="balloon" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFB3C6" /><stop offset="55%" stopColor="#F2577C" /><stop offset="100%" stopColor="#B8264E" /></linearGradient>
    <linearGradient id="foliage" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8FDC8E" /><stop offset="100%" stopColor="#3E9550" /></linearGradient>
  </>
);

const Glow: React.FC<{ x: number; y: number; r: number; night: boolean }> = ({ x, y, r, night }) => (
  <circle cx={x} cy={y} r={night ? r : r * 0.5} fill="url(#warmGlow)" className="twinkle" style={{ animationDuration: '3.5s' }} />
);

const Heart: React.FC<{ x: number; y: number; s: number; fill: string }> = ({ x, y, s, fill }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 2.2 C -3.5 -0.3 -3.2 -3.2 -1.5 -3.2 C -0.6 -3.2 0 -2.6 0 -2 C 0 -2.6 0.6 -3.2 1.5 -3.2 C 3.2 -3.2 3.5 -0.3 0 2.2 Z" fill={fill} />
);

export const DRAWINGS: Record<string, React.FC<{ night: boolean }>> = {
  mailbox: () => (
    <g>
      <rect x="-0.6" y="-9" width="1.2" height="9" fill="url(#wood)" />
      <path d="M-3.4 -9 V -12.5 A 3.4 3.4 0 0 1 3.4 -12.5 V -9 Z" fill="#F48AA0" />
      <path d="M-3.4 -12.5 A 3.4 3.4 0 0 1 0 -15.9" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.6" fill="none" />
      <rect x="3.2" y="-15.5" width="0.6" height="4" fill="#B8385A" />
      <Heart x={4.6} y={-15} s={0.45} fill="#E0335E" />
    </g>
  ),
  bench: () => (
    <g>
      <rect x="-8" y="-9.5" width="16" height="1.4" rx="0.6" fill="url(#woodLight)" />
      <rect x="-8" y="-7.4" width="16" height="1.4" rx="0.6" fill="url(#woodLight)" />
      <rect x="-8.5" y="-4.6" width="17" height="1.6" rx="0.6" fill="url(#wood)" />
      {[-7, 7].map((x) => (
        <rect key={x} x={x - 0.5} y="-10" width="1" height="10" fill="#6E4630" />
      ))}
      <Heart x={0} y={-11.6} s={0.5} fill="#F27A93" />
    </g>
  ),
  picnic: () => (
    <g>
      <path d="M-11 0 L -8 -4 L 9 -4 L 12 0 Z" fill="#fff" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${-10.5 + i * 3.8} 0 L ${-7.6 + i * 2.85} -4 L ${-6.2 + i * 2.85} -4 L ${-8.6 + i * 3.8} 0 Z`} fill="#F27A93" opacity="0.85" />
      ))}
      <path d="M-4 -3 h 6 l -0.8 -4 h -4.4 Z" fill="url(#woodLight)" />
      <path d="M-3.2 -7 C -3.2 -10 1.4 -10 1.4 -7" stroke="#8A5733" strokeWidth="0.6" fill="none" />
      {[5, 7.2].map((x) => (
        <g key={x}>
          <path d={`M${x - 0.9} -7 Q ${x} -4.8 ${x + 0.9} -7 Z`} fill="#E0335E" opacity="0.85" />
          <rect x={x - 0.15} y="-5" width="0.3" height="1.8" fill="#fff" opacity="0.9" />
        </g>
      ))}
    </g>
  ),
  lanterns: ({ night }) => (
    <g>
      {[
        [-9, 0, 1], [9, 0, 1], [-6.5, -9, 0.82], [6.5, -9, 0.82], [-4.4, -17, 0.66], [4.4, -17, 0.66],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-0.35" y="-7" width="0.7" height="7" fill="#4A3B33" />
          <Glow x={0} y={-8.2} r={4} night={night} />
          <rect x="-1.2" y="-9.6" width="2.4" height="2.8" rx="0.5" fill={night ? '#FFE08A' : '#FFF1C9'} stroke="#4A3B33" strokeWidth="0.3" />
          <path d="M-1.6 -9.6 L 0 -10.8 L 1.6 -9.6 Z" fill="#4A3B33" />
        </g>
      ))}
    </g>
  ),
  pets: () => (
    <g>
      {/* kitty */}
      <g transform="translate(-4 0)">
        <ellipse cx="0" cy="-2.6" rx="2.8" ry="2.6" fill="#F6C9A6" />
        <circle cx="0" cy="-6.4" r="2.2" fill="#F6C9A6" />
        <path d="M-2 -7.6 L -1.6 -9.6 L -0.6 -8.1 Z M2 -7.6 L 1.6 -9.6 L 0.6 -8.1 Z" fill="#F6C9A6" />
        <circle cx="-0.8" cy="-6.6" r="0.3" fill="#3F3F46" /><circle cx="0.8" cy="-6.6" r="0.3" fill="#3F3F46" />
        <path d="M-0.3 -5.8 Q 0 -5.5 0.3 -5.8" stroke="#E0335E" strokeWidth="0.25" fill="none" />
        <path d="M2.6 -1.4 C 5 -2 4.6 -5 3.6 -5.4" stroke="#F6C9A6" strokeWidth="0.9" fill="none" strokeLinecap="round" className="sway" />
      </g>
      {/* puppy */}
      <g transform="translate(4 0)">
        <ellipse cx="0" cy="-2.8" rx="3" ry="2.8" fill="#FFF3E6" />
        <circle cx="0" cy="-6.6" r="2.4" fill="#FFF3E6" />
        <ellipse cx="-2.2" cy="-6.4" rx="0.9" ry="1.7" fill="#C88B5A" />
        <ellipse cx="2.2" cy="-6.4" rx="0.9" ry="1.7" fill="#C88B5A" />
        <circle cx="-0.8" cy="-6.8" r="0.3" fill="#3F3F46" /><circle cx="0.8" cy="-6.8" r="0.3" fill="#3F3F46" />
        <ellipse cx="0" cy="-5.8" rx="0.5" ry="0.35" fill="#3F3F46" />
        <Heart x={0} y={-3.4} s={0.3} fill="#F27A93" />
      </g>
    </g>
  ),
  swing: () => (
    <g>
      <path d="M-8 0 L -5 -16 L 5 -16 L 8 0" stroke="url(#wood)" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      <path d="M-5.6 -16 H 5.6" stroke="#8A5733" strokeWidth="1.2" strokeLinecap="round" />
      <g className="sway" style={{ transformOrigin: '50% 0%', animationDuration: '3.2s' }}>
        <path d="M-3 -16 V -5 M 3 -16 V -5" stroke="#B9A48F" strokeWidth="0.35" />
        <rect x="-4" y="-5.4" width="8" height="1.2" rx="0.5" fill="url(#woodLight)" />
        <Heart x={0} y={-8} s={0.4} fill="#F27A93" />
      </g>
    </g>
  ),
  pond: () => (
    <g>
      <ellipse cx="0" cy="-2" rx="17" ry="4.6" fill="#6BAF6F" opacity="0.6" />
      <ellipse cx="0" cy="-2" rx="16" ry="4" fill="url(#water)" />
      <ellipse cx="-5" cy="-3.2" rx="6" ry="0.6" fill="#fff" opacity="0.45" className="twinkle" style={{ animationDuration: '4s' }} />
      <ellipse cx="6" cy="-1" rx="4" ry="0.45" fill="#fff" opacity="0.35" className="twinkle" style={{ animationDuration: '5s', animationDelay: '-2s' }} />
      {[[-11, -1.5], [11, -2.6]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="1.8" ry="0.7" fill="#5DB37A" />
          <circle cx={x + 0.6} cy={y - 0.5} r="0.5" fill="#FFB3C6" />
        </g>
      ))}
      {/* two swans making a heart */}
      <g className="drift" style={{ animationDuration: '9s' }}>
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${d * 2.2} -3) scale(${d} 1)`}>
            <ellipse cx="1.6" cy="0" rx="2.2" ry="0.9" fill="#fff" />
            <path d="M0.4 -0.2 C -0.8 -2.4 0.4 -4.4 1.8 -3.6 C 2.4 -3.2 2 -2.4 1.2 -2.6" stroke="#fff" strokeWidth="0.75" fill="none" strokeLinecap="round" />
            <path d="M1.2 -2.6 l -0.6 0.2" stroke="#F28A3C" strokeWidth="0.4" strokeLinecap="round" />
          </g>
        ))}
      </g>
    </g>
  ),
  bridge: () => (
    <g>
      <path d="M-10 -1 Q 0 -9 10 -1" stroke="url(#wood)" strokeWidth="1.8" fill="none" />
      <path d="M-10 -1 Q 0 -9 10 -1" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.4" fill="none" transform="translate(0 -0.6)" />
      {[-7, -3.5, 0, 3.5, 7].map((x) => {
        const y = -1 - 8 * (1 - (x / 10) ** 2) * 0.5;
        return <rect key={x} x={x - 0.3} y={y - 3.4} width="0.6" height="3.4" fill="#8A5733" />;
      })}
      <path d="M-7 -6.4 Q 0 -10.4 7 -6.4" stroke="#8A5733" strokeWidth="0.5" fill="none" />
    </g>
  ),
  arch: () => (
    <g>
      <path d="M-6 0 V -10 A 6 6 0 0 1 6 -10 V 0" stroke="#5FAE6E" strokeWidth="1.1" fill="none" />
      {Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        const angle = Math.PI * (1 - t);
        const x = t < 0.25 ? -6 : t > 0.75 ? 6 : 6 * Math.cos(angle);
        const y = t < 0.25 ? -t * 40 : t > 0.75 ? -(1 - t) * 40 : -10 - 6 * Math.sin(angle);
        return <circle key={i} cx={x + (i % 2 ? 0.5 : -0.5)} cy={y} r="1.1" fill={i % 3 ? '#F2577C' : '#FFB3C6'} />;
      })}
      <Heart x={0} y={-17.4} s={0.55} fill="#E0335E" />
    </g>
  ),
  fountain: ({ night }) => (
    <g>
      <ellipse cx="0" cy="-1.6" rx="9" ry="2.4" fill="url(#stone)" />
      <ellipse cx="0" cy="-2.2" rx="7.6" ry="1.6" fill="url(#water)" />
      <rect x="-0.9" y="-9" width="1.8" height="7" fill="url(#stone)" />
      <ellipse cx="0" cy="-9" rx="3.6" ry="1" fill="url(#stone)" />
      <ellipse cx="0" cy="-9.3" rx="3" ry="0.6" fill="url(#water)" />
      {[-1, 1].map((d) => (
        <path key={d} d={`M0 -10 Q ${d * 4} -15 ${d * 6} -3`} stroke="#BDEBFA" strokeWidth="0.45" fill="none" strokeDasharray="1.2 1.2" className="shooting-water" />
      ))}
      <path d="M0 -9.5 V -14" stroke="#BDEBFA" strokeWidth="0.5" strokeDasharray="1 1" className="shooting-water" />
      {night && <Glow x={0} y={-6} r={7} night />}
    </g>
  ),
  treehouse: ({ night }) => (
    <g>
      <path d="M-2.4 0 C -2 -10 -3 -18 -3.4 -24 L 3.4 -24 C 3 -18 2 -10 2.4 0 Z" fill="url(#wood)" />
      <circle cx="-7" cy="-27" r="8" fill="url(#foliage)" />
      <circle cx="7" cy="-28" r="8.5" fill="url(#foliage)" />
      <circle cx="0" cy="-34" r="8" fill="url(#foliage)" />
      <rect x="-7" y="-22" width="14" height="1.4" fill="#6E4630" />
      <rect x="-5" y="-30" width="10" height="8" fill="url(#woodLight)" />
      <path d="M-6.4 -30 L 0 -35 L 6.4 -30 Z" fill="url(#roof)" />
      <rect x="-1.4" y="-28" width="2.8" height="2.8" rx="0.4" fill={night ? '#FFE08A' : '#BDEBFA'} />
      {night && <Glow x={0} y={-26.6} r={5} night />}
      <path d="M4 -21 L 5.5 -6 M 6.2 -21 L 7.7 -6" stroke="#8A5733" strokeWidth="0.4" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${4.2 + i * 0.25} ${-19 + i * 2.4} h 2.2`} stroke="#8A5733" strokeWidth="0.35" />
      ))}
      <Heart x={0} y={-36.8} s={0.4} fill="#F27A93" />
    </g>
  ),
  balloon: () => (
    <g className="drift" style={{ animationDuration: '12s' }}>
      <path d="M0 2 C -12 -6 -11 -18 -5 -18 C -2 -18 0 -16 0 -14 C 0 -16 2 -18 5 -18 C 11 -18 12 -6 0 2 Z" fill="url(#balloon)" />
      <path d="M-6 -15 C -9 -14 -9 -9 -7 -7" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M-2.2 1 L -1.6 6 M 2.2 1 L 1.6 6" stroke="#8A5733" strokeWidth="0.3" />
      <rect x="-2" y="6" width="4" height="3" rx="0.6" fill="url(#woodLight)" />
    </g>
  ),
  windmill: () => (
    <g>
      <path d="M-3.6 0 L -2.2 -18 L 2.2 -18 L 3.6 0 Z" fill="url(#wall)" />
      <path d="M-2.8 -18 L 0 -22 L 2.8 -18 Z" fill="url(#roof)" />
      <rect x="-1" y="-4" width="2" height="4" rx="1" fill="url(#wood)" />
      <g transform="translate(0 -18)">
        <g className="rays" style={{ animationDuration: '14s' }}>
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <rect x="-0.35" y="-11" width="0.7" height="11" fill="#8A5733" />
              <rect x="0.35" y="-10.5" width="2.6" height="7" fill="#FFF7EE" opacity="0.95" />
            </g>
          ))}
        </g>
        <circle r="0.9" fill="#6E4630" />
      </g>
    </g>
  ),
  cottage: ({ night }) => (
    <g>
      {/* chimney smoke */}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx="7.5" cy="-24" r="1.4" fill="#fff" opacity="0.7" className="rise" style={{ animationDelay: `${i * 1.6}s`, animationDuration: '5s' }} />
      ))}
      <rect x="6" y="-24" width="2.6" height="5" fill="#B8385A" />
      <rect x="-12" y="-14" width="24" height="14" rx="0.6" fill="url(#wall)" />
      <path d="M-14 -13.4 L 0 -25 L 14 -13.4 Z" fill="url(#roof)" />
      <path d="M-11 -14.6 L 0 -23.6" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.6" />
      <path d="M-2.6 0 V -7 A 2.6 2.6 0 0 1 2.6 -7 V 0 Z" fill="url(#wood)" />
      <Heart x={0} y={-7.2} s={0.38} fill="#F27A93" />
      {[-7.5, 7.5].map((x) => (
        <g key={x}>
          {night && <Glow x={x} y={-8.6} r={6} night />}
          <rect x={x - 2.4} y="-11" width="4.8" height="4.4" rx="0.5" fill={night ? '#FFE08A' : '#BDEBFA'} stroke="#fff" strokeWidth="0.5" />
          <path d={`M${x} -11 V -6.6 M ${x - 2.4} -8.8 H ${x + 2.4}`} stroke="#fff" strokeWidth="0.4" />
          <rect x={x - 2.8} y="-6.6" width="5.6" height="1.2" rx="0.5" fill="#F48AA0" />
        </g>
      ))}
      <path d="M-12 0 Q -14 -2 -12.5 -3 M 12 0 Q 14 -2 12.5 -3" stroke="#5FAE6E" strokeWidth="1.2" fill="none" />
    </g>
  ),
  gazebo: ({ night }) => (
    <g>
      <ellipse cx="0" cy="-0.6" rx="11" ry="1.6" fill="url(#stone)" />
      {[-9, -3, 3, 9].map((x) => (
        <rect key={x} x={x - 0.5} y="-14" width="1" height="13.4" fill="url(#wall)" />
      ))}
      <path d="M-12 -14 Q 0 -17 12 -14 L 0 -24 Z" fill="url(#roof)" />
      <path d="M-12 -14 Q 0 -17 12 -14" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.5" fill="none" />
      <circle cx="0" cy="-24.6" r="0.9" fill="#FFD66B" />
      {/* fairy lights */}
      {Array.from({ length: 13 }, (_, i) => {
        const x = -11 + i * (22 / 12);
        const y = -13 + Math.sin((i / 12) * Math.PI) * 2.4;
        return (
          <circle key={i} cx={x} cy={y} r={night ? 0.55 : 0.4} fill={['#FFE08A', '#FFB3C6', '#BDEBFA'][i % 3]} className="twinkle" style={{ animationDelay: `${i * 0.23}s`, animationDuration: '2.2s' }} />
        );
      })}
      {night && <Glow x={0} y={-8} r={14} night />}
    </g>
  ),
};

/** viewBox for each drawing when shown on its own (shop thumbnails). */
export const PREVIEW_BOX: Record<string, string> = {
  mailbox: '-6 -18 12 19',
  bench: '-10 -13 20 14',
  picnic: '-12 -11 25 12',
  lanterns: '-12 -29 24 30',
  pets: '-9 -11 18 12',
  swing: '-10 -18 20 19',
  pond: '-18 -9 36 10',
  bridge: '-12 -12 24 13',
  arch: '-9 -21 18 22',
  fountain: '-10 -16 20 17',
  treehouse: '-16 -43 32 44',
  balloon: '-13 -20 26 30',
  windmill: '-12 -30 24 31',
  cottage: '-15 -27 30 28',
  gazebo: '-13 -27 26 28',
};
