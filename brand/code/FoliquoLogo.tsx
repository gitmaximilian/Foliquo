import React, {useId} from 'react';

/** Import '@fontsource-variable/manrope' once in the app's entry file. */
export type FoliquoLogoProps = {
  edition?: 'standard' | 'community';
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
  monochrome?: boolean;
  size?: number; // icon height in px
  className?: string;
};

// "Glasblätter": two overlapping pages, the original and its translation (400 × 400 box).
const BACK = {x: 50, y: 50, width: 200, height: 262, rx: 50, transform: 'rotate(-9 150 181)'};
const FRONT = {x: 150, y: 88, width: 200, height: 262, rx: 50, transform: 'rotate(7 250 219)'};
const LINES = 'M194 169h100M194 212h100M194 256h62';

export function FoliquoLogo({
  edition='standard', variant='full', theme='light', monochrome=false,
  size=40, className
}: FoliquoLogoProps) {
  const id = useId().replace(/:/g, '');
  const foreground = theme === 'dark' ? '#FFFFFF' : '#0F1115';
  const glass = edition === 'community';
  const back = monochrome ? foreground : glass ? `url(#${id}-back)` : '#2F6BFF';
  const front = monochrome ? foreground : glass ? `url(#${id}-front)` : '#7C3AED';
  const symbol = (
    <svg viewBox="0 0 400 400" width={size} height={size} aria-hidden="true" focusable="false">
      {glass && !monochrome && (
        <defs>
          <linearGradient id={`${id}-back`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7FB2FF"/><stop offset="1" stopColor="#2F6BFF"/></linearGradient>
          <linearGradient id={`${id}-front`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C4A6FF"/><stop offset="1" stopColor="#7C3AED"/></linearGradient>
        </defs>
      )}
      <rect {...BACK} fill={back}/>
      <rect {...FRONT} fill={front} fillOpacity={monochrome ? .55 : glass ? .78 : .86}/>
      {!monochrome && <path d={LINES} fill="none" stroke="#FFFFFF" strokeOpacity=".92" strokeWidth="22" strokeLinecap="round" transform={FRONT.transform}/>}
    </svg>
  );
  if(variant === 'icon') {
    return <span className={className} role="img" aria-label={'foliquo'+(glass?' Community':'')} style={{display:'inline-flex',lineHeight:0}}>{symbol}</span>;
  }
  return (
    <span className={className} aria-label={'foliquo'+(glass?' Community':'')} style={{display:'inline-flex',alignItems:'center',gap:size*.14,lineHeight:1,color:foreground}}>
      {symbol}
      <span style={{fontFamily:'Manrope, sans-serif',fontWeight:700,fontSize:size*.74,letterSpacing:'-0.05em',whiteSpace:'nowrap'}}>foliquo</span>
    </span>
  );
}
