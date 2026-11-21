import React from 'react';

/** Import '@fontsource-variable/manrope' once in the app's entry file. */
export type FoliquoLogoProps = {
  edition?: 'standard' | 'community';
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
  monochrome?: boolean;
  size?: number; // icon height in px
  className?: string;
};

const SILHOUETTE = "M 107.5 40 H 292.5 A 50.5 50.5 0 0 1 292.5 141 H 170 A 12 12 0 0 0 158 153 V 309.5 A 50.5 50.5 0 0 1 57 309.5 V 90.5 A 50.5 50.5 0 0 1 107.5 40 Z";

export function FoliquoLogo({
  edition='standard', variant='full', theme='light', monochrome=false,
  size=40, className
}: FoliquoLogoProps) {
  const foreground=theme==='dark' ? '#FFFFFF' : '#0F1115';
  const accent=monochrome ? foreground : '#3B82F6';
  const symbol=(
    <svg viewBox="0 0 400 400" width={size} height={size} aria-hidden="true" focusable="false">
      {edition === 'community' ? (
        <>
          <path d={SILHOUETTE} fill="none" stroke={foreground} strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
          <rect x="192" y="183" width="151" height="92" rx="46" fill="none" stroke={accent} strokeWidth="9"/>
        </>
      ) : (
        <>
          <path d={SILHOUETTE} fill={foreground} />
          <rect x="192" y="183" width="151" height="92" rx="46" fill={accent} />
        </>
      )}
    </svg>
  );
  if(variant==='icon') {
    return <span className={className} role="img" aria-label={'foliquo'+(edition==='community'?' Community':'')} style={{display:'inline-flex',lineHeight:0}}>{symbol}</span>;
  }
  return (
    <span className={className} aria-label={'foliquo'+(edition==='community'?' Community':'')} style={{display:'inline-flex',alignItems:'center',gap:size*.14,lineHeight:1,color:foreground}}>
      {symbol}
      <span style={{fontFamily:'Manrope, sans-serif',fontWeight:700,fontSize:size*.74,letterSpacing:'-0.05em',whiteSpace:'nowrap'}}>foliquo</span>
    </span>
  );
}
